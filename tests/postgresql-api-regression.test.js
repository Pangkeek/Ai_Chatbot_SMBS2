import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import { createTestDatabase } from '../integration/postgresql-fixture.js';
import { migratePostgresql } from '../scripts/postgresql/migrations.js';
import { seedDemo, demoPassword } from '../src/lib/seed.js';
import { createService } from '../src/services/service.js';
import { createLineWorker } from '../src/services/worker.js';
import { createApp } from '../src/lib/app.js';
import { handleApiRequest, closeApiRuntime } from '../src/lib/apiRuntime.js';

let fixture, db, service, server, url;
before(async () => {
  fixture = await createTestDatabase(); db = fixture.db;
  await migratePostgresql({ config: fixture.config });
  await seedDemo(db);
  service = createService(db, { workerOptions: { logErrors: false } });
  server = createApp(db, { logErrors: false });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  url = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) { await new Promise(resolve => server.close(resolve)); await server.drain(); }
  await service?.worker.drain(); await fixture?.dispose();
});
const count = async table => Number((await db.query(`SELECT count(*) FROM ${table}`)).rows[0].count);
async function post(path, body, token) {
  const response = await fetch(url + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}

test('concurrent mixed-case registration returns one 201, one EMAIL_EXISTS and one session', async () => {
  const results = await Promise.all(['RACE@example.test','race@example.test'].map(email => post('/api/v1/auth/register', { email, name: 'Race', password: 'Password123!' })));
  assert.deepEqual(results.map(r => r.status).sort(), [201,409]);
  assert.equal(results.find(r => r.status === 409).body.error.code, 'EMAIL_EXISTS');
  const id = results.find(r => r.status === 201).body.data.user.id;
  assert.equal((await db.query('SELECT * FROM sessions WHERE user_id=$1', [id])).rowCount, 1);
  await db.query("UPDATE users SET email='COFFEE@example.test' WHERE id='user-coffee'");
  const login = await service.login({ body: { email: 'coffee@example.test', password: demoPassword } });
  assert.equal(login.data.user.id, 'user-coffee');
  assert.equal(login.data.user.password_hash, undefined);
});

test('registration/session, shop/owner and message/timestamp failures roll back atomically', async () => {
  const users = await count('users');
  await db.query("CREATE FUNCTION reject_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture-private-detail'; END $$");
  await db.query('CREATE TRIGGER reject_session BEFORE INSERT ON sessions FOR EACH ROW EXECUTE FUNCTION reject_write()');
  try { await assert.rejects(service.register({ body: { email: 'rollback@example.test', name: 'Rollback', password: 'Password123!' } })); }
  finally { await db.query('DROP TRIGGER reject_session ON sessions'); }
  assert.equal(await count('users'), users);
  const shops = await count('shops');
  await assert.rejects(service.createShop({ user: { id: 'missing-owner' }, body: { name: 'Must rollback' } }), { code: '23503' });
  assert.equal(await count('shops'), shops);
  const messages = await count('messages');
  const beforeTime = (await db.query("SELECT updated_at FROM conversations WHERE id='shop-coffee-conversation-1'")).rows[0].updated_at;
  await db.query('CREATE TRIGGER reject_conversation BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION reject_write()');
  try { await assert.rejects(service.createMessage({ params: { shopId: 'shop-coffee', conversationId: 'shop-coffee-conversation-1' }, user: { id: 'user-coffee' }, body: { role: 'customer', content: 'Must rollback' } })); }
  finally { await db.query('DROP TRIGGER reject_conversation ON conversations'); }
  assert.equal(await count('messages'), messages);
  assert.deepEqual((await db.query("SELECT updated_at FROM conversations WHERE id='shop-coffee-conversation-1'")).rows[0].updated_at, beforeTime);
});

test('concurrent LINE partial configuration keeps both credentials; concurrent redelivery queues once', async () => {
  const params = { shopId: 'shop-coffee' };
  await service.updateLineConfig({ params, body: { channel_secret: 'original-secret', channel_access_token: 'original-token' } });
  await Promise.all([
    service.updateLineConfig({ params, body: { channel_secret: 'new-secret' } }),
    service.updateLineConfig({ params, body: { channel_access_token: 'new-token' } }),
  ]);
  const channel = (await db.query('SELECT * FROM line_channels WHERE shop_id=$1', [params.shopId])).rows[0];
  assert.equal(channel.channel_secret, 'new-secret'); assert.equal(channel.channel_access_token, 'new-token');
  let enqueued = 0;
  const webhook = createService(db, { worker: { wake() { enqueued++; } } });
  const body = { events: [{ type: 'message', webhookEventId: 'race-event', source: { userId: 'customer' }, message: { type: 'text', text: 'hi' } }] };
  const rawBody = JSON.stringify(body);
  const headers = { 'x-line-signature': createHmac('sha256', 'new-secret').update(rawBody).digest('base64') };
  const responses = await Promise.all([webhook.lineWebhook({ params, body, rawBody, headers }), webhook.lineWebhook({ params, body, rawBody, headers })]);
  assert.deepEqual(responses.map(r => r.data.processed_count).sort(), [0,1]);
  assert.equal(enqueued, 1);
});

test('async generation has no held transaction and respects bot-mode changes before send', async () => {
  let sent = 0;
  const worker = createLineWorker(db, { sendReply: async () => { sent++; }, generateReply: async ({ conversation }) => {
    await db.query("UPDATE conversations SET bot_mode='paused' WHERE id=$1", [conversation.id]);
    return 'Awaited reply';
  } });
  const result = await worker.handleMessageEvent({ shopId: 'shop-coffee', simulated: true, event: { source: { userId: 'async-user' }, message: { text: 'hello' } } });
  assert.equal(result.replied, false); assert.equal(sent, 0);
  assert.equal((await db.query('SELECT * FROM messages WHERE conversation_id=$1', [result.conversationId])).rowCount, 1);
});

test('production simulator returns 404 before auth/body processing and seed refuses without writes', async () => {
  const old = process.env.NODE_ENV;
  const before = await count('line_events');
  process.env.NODE_ENV = 'production';
  try {
    assert.equal((await post('/api/v1/shops/shop-coffee/line/simulate', { user_id: 'blocked', text: 'blocked' })).status, 404);
    await assert.rejects(seedDemo(db), /disabled in production/);
    await assert.rejects(service.simulateLineMessage({ params: { shopId: 'shop-coffee' }, body: {} }), { status: 404 });
  } finally { if (old === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = old; }
  assert.equal(await count('line_events'), before);
});

test('PostgreSQL errors stay generic, and a non-email unique violation is not EMAIL_EXISTS', async () => {
  const login = await service.login({ body: { email: 'coffee@example.test', password: demoPassword } });
  await db.query("CREATE FUNCTION reject_unique() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture-private-detail' USING ERRCODE='23505', CONSTRAINT='other_unique'; END $$");
  await db.query('CREATE TRIGGER reject_shop BEFORE INSERT ON shops FOR EACH ROW EXECUTE FUNCTION reject_unique()');
  try {
    const response = await post('/api/v1/shops', { name: 'hidden error' }, login.data.access_token);
    assert.equal(response.status, 500); assert.equal(response.body.error.code, 'INTERNAL_ERROR');
    assert.equal(JSON.stringify(response.body).includes('fixture-private-detail'), false);
  } finally { await db.query('DROP TRIGGER reject_shop ON shops'); }
});

test('health returns safe 503 when a database query fails after initialization', async () => {
  const failedDb = { async query() { throw new Error('postgresql://private-credential@host'); } };
  const failedServer = createApp(failedDb, { logErrors: false });
  failedServer.listen(0, '127.0.0.1'); await once(failedServer, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${failedServer.address().port}/health`);
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.error.code, 'DATABASE_UNAVAILABLE');
    assert.equal(JSON.stringify(body).includes('private-credential'), false);
  } finally { await new Promise(resolve => failedServer.close(resolve)); }
});

test('runtime initialization failure returns safe 503, then retries with migrated PostgreSQL', async () => {
  const saved = { DATABASE_URL: process.env.DATABASE_URL, DB_SCHEMA: process.env.DB_SCHEMA, DB_SSL_MODE: process.env.DB_SSL_MODE };
  const runtimeServer = createServer(handleApiRequest);
  runtimeServer.listen(0, '127.0.0.1'); await once(runtimeServer, 'listening');
  const endpoint = `http://127.0.0.1:${runtimeServer.address().port}/health`;
  try {
    delete process.env.DATABASE_URL;
    const failed = await fetch(endpoint);
    assert.equal(failed.status, 503); assert.equal((await failed.json()).error.code, 'DATABASE_UNAVAILABLE');
    process.env.DATABASE_URL = fixture.config.connectionString; process.env.DB_SCHEMA = fixture.schema; process.env.DB_SSL_MODE = 'disable';
    const healthy = await fetch(endpoint);
    assert.equal(healthy.status, 200); assert.equal((await healthy.json()).data.database, 'ok');
  } finally {
    await new Promise(resolve => runtimeServer.close(resolve)); await closeApiRuntime();
    for (const [key,value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
