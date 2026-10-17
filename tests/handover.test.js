import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createTestDatabase } from '../integration/postgresql-fixture.js';
import { migratePostgresql } from '../scripts/postgresql/migrations.js';
import { seedDemo, demoPassword } from '../src/lib/seed.js';
import { createApp } from '../src/lib/app.js';
import { insertConversation } from './fixtures/conversation-data.js';
import { createService } from '../src/services/service.js';
import { createLineWorker } from '../src/services/worker.js';
import { sendLinePush } from '../src/services/line.js';

let fixture, db, server, base, token;
const delivered = [];
let sender = async payload => { delivered.push(payload); };
const path = '/api/v1/shops/shop-coffee/conversations/handover';
async function request(url, method = 'GET', body, auth = token) {
  const response = await fetch(base + url, { method, headers: {
    ...(auth ? { Authorization: `Bearer ${auth}` } : {}), 'Content-Type': 'application/json',
  }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
}
before(async () => {
  fixture = await createTestDatabase(); db = fixture.db;
  await migratePostgresql({ config: fixture.config }); await seedDemo(db);
  const time = new Date().toISOString();
  await insertConversation(db, 'handover', 'shop-coffee', 'line', 'U-handover', 'ลูกค้า', 'open', 'active', time, time);
  server = createApp(db, { logErrors: false, serviceOptions: { sendPush: payload => sender(payload) } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
  token = (await request('/api/v1/auth/login', 'POST', { email: 'coffee@example.test', password: demoPassword }, null)).body.data.access_token;
  await request('/api/v1/shops/shop-coffee/line/config', 'PUT', { channel_secret: 'test-only', channel_access_token: 'test-only-token' });
});
after(async () => {
  if (server) { await new Promise(resolve => server.close(resolve)); await server.drain(); }
  await fixture?.dispose();
});

test('take over, push to stored LINE customer once, record confirmed history, then resume', async () => {
  assert.equal((await request(path, 'PATCH', { bot_mode: 'human' })).status, 200);
  const body = { request_id: randomUUID(), content: 'แอดมินรับเรื่องแล้วครับ' };
  const result = await request(path + '/replies', 'POST', body);
  assert.equal(result.status, 200);
  assert.equal(result.body.data.status, 'sent');
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].to, 'U-handover');
  assert.equal(delivered[0].messages[0].text, body.content);
  assert.equal((await request(path + '/replies', 'POST', body)).body.data.id, result.body.data.id);
  assert.equal(delivered.length, 1);
  const messages = (await request(path + '/messages')).body.data;
  assert.equal(messages.length, 1);
  assert.equal(messages[0].role, 'agent');
  assert.equal(messages[0].author_user_id, 'user-coffee');
  assert.equal((await request(path, 'PATCH', { bot_mode: 'active' })).status, 200);
  assert.equal((await request(path + '/replies', 'POST', { ...body, request_id: randomUUID() })).status, 409);
});

test('pending send blocks resume and concurrent sends; uncertain sends remain visible without duplicate delivery', async () => {
  await request(path, 'PATCH', { bot_mode: 'paused' });
  let release, started;
  const ready = new Promise(resolve => { started = resolve; });
  const barrier = new Promise(resolve => { release = resolve; });
  sender = async () => { started(); await barrier; throw new Error('Connection dropped after acceptance'); };
  const body = { request_id: randomUUID(), content: 'รอตรวจสอบ' };
  const sending = request(path + '/replies', 'POST', body);
  try {
    await ready;
    assert.equal((await request(path, 'PATCH', { bot_mode: 'active' })).status, 409);
    assert.equal((await request(path + '/replies', 'POST', { ...body, request_id: randomUUID() })).status, 409);
    assert.equal((await request(path + '/replies', 'POST', body)).body.data.status, 'sending');
  } finally { release(); }
  const result = await sending;
  assert.equal(result.body.data.status, 'unknown');
  assert.equal((await request(path + '/replies', 'POST', body)).body.data.status, 'unknown');
  assert.equal((await request(path + '/messages')).body.data.length, 1);
  assert.equal((await request(path + '/replies')).body.data[0].status, 'unknown');
});

test('pause and resume fences an AI answer already being generated; a fresh event can reply', async () => {
  let release, started, sent = 0;
  const ready = new Promise(resolve => { started = resolve; });
  const barrier = new Promise(resolve => { release = resolve; });
  const service = createService(db, { worker: { wake() {} } });
  const worker = createLineWorker(db, { logErrors: false,
    generateReply: async () => { started(); await barrier; return 'คำตอบ'; }, sendReply: async () => { sent++; } });
  await request(path, 'PATCH', { bot_mode: 'active' });
  const event = { type: 'message', webhookEventId: randomUUID(), replyToken: 'test-reply',
    source: { userId: 'U-handover' }, message: { type: 'text', text: 'สอบถาม' } };
  const pending = worker.handleMessageEvent({ shopId: 'shop-coffee', event });
  try {
    await ready;
    await service.updateConversation({ params: { shopId: 'shop-coffee', conversationId: 'handover' }, body: { bot_mode: 'paused' } });
    await service.updateConversation({ params: { shopId: 'shop-coffee', conversationId: 'handover' }, body: { bot_mode: 'active' } });
    release(); await pending;
    assert.equal(sent, 0, 'คำตอบก่อนพักบอทต้องไม่กลับมาหลัง Resume');
    await worker.handleMessageEvent({ shopId: 'shop-coffee', event: { ...event, webhookEventId: randomUUID() } });
    assert.equal(sent, 1);
  } finally { release(); await pending; await worker.stop(); }
});

test('LINE push uses a retry key and timeout without leaking rejected provider bodies', async () => {
  const retryKey = randomUUID(); let seen;
  const input = { channelAccessToken: 'test-only', to: 'U-fixture', messages: [{ type: 'text', text: 'hello' }], retryKey };
  await assert.rejects(sendLinePush({ ...input, fetchImpl: async (_url, options) => {
    seen = options; return new Response('private-provider-debug', { status: 401 });
  } }), error => error.code === 'LINE_HTTP_REJECTED' && error.statusCode === 401 && !error.message.includes('private-provider-debug'));
  assert.equal(seen.headers['X-Line-Retry-Key'], retryKey);
  assert.ok(seen.signal);
  const accepted = await sendLinePush({ ...input, fetchImpl: async () => new Response('{}', { status: 409, headers: { 'x-line-accepted-request-id': 'accepted-test-id' } }) });
  assert.equal(accepted.status, 'ok');
});

test('reply authorization, content validation, rejection and crash recovery never invent delivered history', async () => {
  const body = { request_id: randomUUID(), content: 'ทดสอบสิทธิ์' };
  assert.equal((await request(path + '/replies', 'POST', body, null)).status, 401);
  assert.equal((await request(path.replace('shop-coffee', 'shop-flower') + '/replies', 'POST', body)).status, 404);
  assert.equal((await request(path.replace('handover', 'shop-flower-conversation-1') + '/replies', 'POST', body)).status, 404);
  for (const invalid of [{ ...body, content: ' ' }, { ...body, content: 'x'.repeat(5001) }, { ...body, request_id: 'bad' }, { ...body, to: 'U-other' }]) {
    assert.equal((await request(path + '/replies', 'POST', invalid)).status, 422);
  }
  await request(path, 'PATCH', { bot_mode: 'paused' });
  sender = async () => { const error = new Error('private-provider-debug'); error.code = 'LINE_HTTP_REJECTED'; error.statusCode = 401; throw error; };
  const before = (await request(path + '/messages')).body.meta.total;
  const rejected = await request(path + '/replies', 'POST', body);
  assert.equal(rejected.body.data.status, 'failed');
  assert.ok(!JSON.stringify(rejected).includes('private-provider-debug'));
  assert.equal((await request(path + '/messages')).body.meta.total, before);
  assert.equal((await request(path + '/replies', 'POST', { ...body, content: 'changed' })).status, 409);
  await db.query("UPDATE agent_deliveries SET status='sending',created_at=clock_timestamp()-interval '1 minute' WHERE id=$1", [rejected.body.data.id]);
  assert.equal((await request(path + '/replies', 'POST', body)).body.data.status, 'unknown');
  await request(path, 'PATCH', { status: 'closed' });
  assert.equal((await request(path + '/replies', 'POST', { ...body, request_id: randomUUID() })).status, 409);
  await request(path, 'PATCH', { status: 'open' });
  await db.query("UPDATE shop_memberships SET role='agent' WHERE shop_id='shop-coffee' AND user_id='user-coffee'");
  assert.equal((await request(path, 'PATCH', { bot_mode: 'human' })).status, 200);
  sender = async payload => { delivered.push(payload); };
  assert.equal((await request(path + '/replies', 'POST', { ...body, request_id: randomUUID() })).body.data.status, 'sent');
});

test('events queued during pause are not replayed after resume, and bot sending blocks mode changes', async () => {
  let sent = 0, release, started, hold = false;
  const ready = new Promise(resolve => { started = resolve; });
  const barrier = new Promise(resolve => { release = resolve; });
  const worker = createLineWorker(db, { logErrors: false, sendReply: async () => { sent++; if (hold) { started(); await barrier; } } });
  const service = createService(db, { worker: { wake() {} } });
  const { recordLineEvents } = await import('../src/services/lineJobs.js');
  const { transaction } = await import('../src/lib/db.js');
  const event = { type: 'message', webhookEventId: randomUUID(), replyToken: 'test-reply', source: { userId: 'U-handover' }, message: { type: 'text', text: 'ระหว่างพัก' } };
  await request(path, 'PATCH', { bot_mode: 'paused' });
  await transaction(db, tx => recordLineEvents(tx, 'shop-coffee', [event]));
  await request(path, 'PATCH', { bot_mode: 'active' });
  try {
    await worker.runOnce();
    assert.equal(sent, 0, 'Resume ไม่ควรส่งข้อความที่เข้ามาตอนพักบอท');
    hold = true;
    const pending = worker.handleMessageEvent({ shopId: 'shop-coffee', event: { ...event, webhookEventId: randomUUID() } });
    await ready;
    await assert.rejects(service.updateConversation({ params: { shopId: 'shop-coffee', conversationId: 'handover' }, body: { bot_mode: 'human' } }), { code: 'DELIVERY_IN_PROGRESS' });
    release(); await pending;
  } finally { release(); await worker.stop(); }
});

test('hard timeout aborts LINE and a database failure after acceptance never resends or records false success', async () => {
  await request(path, 'PATCH', { bot_mode: 'human' });
  const before = (await request(path + '/messages')).body.meta.total;
  let signal, calls = 0;
  sender = payload => { calls++; signal = payload.signal; return new Promise(() => {}); };
  const body = { request_id: randomUUID(), content: 'ทดสอบ timeout' };
  assert.equal((await request(path + '/replies', 'POST', body)).body.data.status, 'unknown');
  assert.equal(signal.aborted, true);
  assert.equal((await request(path + '/replies', 'POST', body)).body.data.status, 'unknown');
  assert.equal(calls, 1);
  sender = async () => { calls++; };
  await db.query(`CREATE FUNCTION reject_agent_message() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.role='agent' THEN RAISE EXCEPTION 'fixture failure after acceptance'; END IF; RETURN NEW; END $$`);
  await db.query('CREATE TRIGGER reject_agent_message BEFORE INSERT ON messages FOR EACH ROW EXECUTE FUNCTION reject_agent_message()');
  const second = { request_id: randomUUID(), content: 'ทดสอบ checkpoint' };
  try {
    assert.equal((await request(path + '/replies', 'POST', second)).status, 500);
    assert.equal((await request(path + '/replies', 'POST', second)).body.data.status, 'sending');
    assert.equal(calls, 2);
    await db.query("UPDATE agent_deliveries SET created_at=clock_timestamp()-interval '1 minute' WHERE request_id=$1", [second.request_id]);
    assert.equal((await request(path + '/replies', 'POST', second)).body.data.status, 'unknown');
    assert.equal((await request(path + '/messages')).body.meta.total, before);
    assert.equal(calls, 2);
  } finally { await db.query('DROP TRIGGER reject_agent_message ON messages'); }
});

test('a fresh event in the same millisecond as Resume is not mistaken for a stale event', async () => {
  await request(path, 'PATCH', { bot_mode: 'active' });
  const { recordLineEvents } = await import('../src/services/lineJobs.js');
  const { transaction } = await import('../src/lib/db.js');
  const event = { type: 'message', webhookEventId: randomUUID(), replyToken: 'test-reply', source: { userId: 'U-handover' }, message: { type: 'text', text: 'ข้อความใหม่' } };
  await transaction(db, async tx => {
    await recordLineEvents(tx, 'shop-coffee', [event]);
    await tx.query(`UPDATE conversations SET bot_changed_at=date_trunc('milliseconds',clock_timestamp())+interval '500 microseconds' WHERE id='handover'`);
    await tx.query(`UPDATE line_jobs SET received_at=(SELECT bot_changed_at+interval '400 microseconds' FROM conversations WHERE id='handover') WHERE event_id=$1`, [event.webhookEventId]);
  });
  let sent = 0;
  const worker = createLineWorker(db, { logErrors: false, sendReply: async () => { sent++; } });
  try { await worker.runOnce(); assert.equal(sent, 1); } finally { await worker.stop(); }
});
