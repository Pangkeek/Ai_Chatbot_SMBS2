import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHmac } from 'node:crypto';
import { openDatabase } from '../src/lib/db.js';
import { seedDemo, demoPassword } from '../src/lib/seed.js';
import { createApp } from '../src/lib/app.js';
import { routes, schemas, openapi } from '../src/lib/contracts.js';
import { validate } from '../src/utils/validation.js';
import { tokenHash } from '../src/lib/auth.js';

let db, server, url, coffee, flower;
const exercised = new Set();
async function request(method, path, body, token, overrides = {}) {
  const response = await fetch(url + path, {
    method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...overrides.headers },
    ...(body !== undefined ? { body: overrides.raw ? body : JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : undefined;
  if (response.status >= 400) {
    assert.deepEqual(validate(payload, schemas.Error), [], JSON.stringify(payload));
    assert.equal(payload.request_id, response.headers.get('x-request-id'));
  } else {
    const route = routes.find(r => r.method === method && new RegExp(`^${r.path.replace(/\{\w+\}/g, '[^/]+')}$`).test(path.split('?')[0]));
    if (route) {
      assert.equal(response.status, route.status);
      if (route.response) assert.deepEqual(validate(payload, route.response), [], JSON.stringify(payload));
      else assert.equal(text, '');
      exercised.add(route.operationId);
    }
  }
  return { status: response.status, payload, headers: response.headers };
}
before(async () => {
  db = openDatabase(':memory:');
  await seedDemo(db);
  server = createApp(db, { logErrors: false, serviceOptions: {
    workerOptions: { sendReply: async () => ({ status: 'ok' }), logErrors: false },
    lineFetch: async (endpoint) => {
      const webhookUrl = 'https://example.com/api/v1/shops/shop-coffee/line/webhook';
      if (endpoint.endsWith('/info')) return new Response(JSON.stringify({ displayName: 'Coffee Bot' }), { status: 200 });
      if (endpoint.endsWith('/endpoint')) return new Response(JSON.stringify({ endpoint: webhookUrl, active: true }), { status: 200 });
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    },
  } });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  url = `http://127.0.0.1:${server.address().port}`;
  coffee = (await request('POST', '/api/v1/auth/login', { email: 'coffee@example.test', password: demoPassword })).payload.data.access_token;
  flower = (await request('POST', '/api/v1/auth/login', { email: 'flower@example.test', password: demoPassword })).payload.data.access_token;
});
after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); });

test('health and OpenAPI contract are available', async () => {
  assert.equal((await request('GET', '/health')).payload.data.database, 'ok');
  const contract = await (await fetch(url + '/openapi.json')).json();
  assert.deepEqual(contract, openapi);
});

test('seed is repeatable and preserves edited content and row counts', async () => {
  db.prepare("UPDATE knowledge_entries SET title = 'Edited' WHERE id = 'shop-coffee-kb-1'").run();
  await seedDemo(db);
  for (const [table, n] of [['users', 2], ['shops', 2], ['knowledge_entries', 6], ['conversations', 2], ['messages', 4]]) {
    assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, n);
  }
  assert.equal(db.prepare("SELECT title FROM knowledge_entries WHERE id = 'shop-coffee-kb-1'").get().title, 'Edited');
  db.prepare("UPDATE knowledge_entries SET title = 'เวลาเปิดร้าน' WHERE id = 'shop-coffee-kb-1'").run();
  await seedDemo(db);
});

test('registration, session revocation, expiry, duplicate emails and private user fields', async () => {
  const created = await request('POST', '/api/v1/auth/register', { email: 'NEW@example.test', password: 'Password123!', name: 'New user' });
  assert.equal(created.status, 201);
  const token = created.payload.data.access_token;
  assert.equal(created.payload.data.user.email, 'new@example.test');
  assert.equal(created.payload.data.user.password_hash, undefined);
  assert.notEqual(db.prepare('SELECT password_hash FROM users WHERE id = ?').get(created.payload.data.user.id).password_hash, 'Password123!');
  assert.equal(db.prepare('SELECT token_hash FROM sessions WHERE user_id = ?').get(created.payload.data.user.id).token_hash, tokenHash(token));
  assert.equal((await request('GET', '/api/v1/users/me', undefined, token)).status, 200);
  assert.equal((await request('POST', '/api/v1/auth/register', { email: 'new@example.test', password: 'Password123!', name: 'Duplicate' })).status, 409);
  assert.equal((await request('POST', '/api/v1/auth/login', { email: 'new@example.test', password: 'wrongPassword' })).status, 401);
  assert.equal((await request('POST', '/api/v1/auth/logout', undefined, token)).status, 204);
  assert.equal((await request('GET', '/api/v1/users/me', undefined, token)).status, 401);
  const session = (await request('POST', '/api/v1/auth/login', { email: 'new@example.test', password: 'Password123!' })).payload.data;
  db.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?').run('2000-01-01T00:00:00.000Z', tokenHash(session.access_token));
  assert.equal((await request('GET', '/api/v1/users/me', undefined, session.access_token)).status, 401);
});

test('shops can be created and updated with an atomic owner membership', async () => {
  const created = await request('POST', '/api/v1/shops', { name: 'New shop' }, coffee);
  assert.equal(created.status, 201);
  const id = created.payload.data.id;
  assert.equal(created.payload.data.member_role, 'owner');
  assert.equal(db.prepare('SELECT role FROM shop_memberships WHERE shop_id = ? AND user_id = ?').get(id, 'user-coffee').role, 'owner');
  // ตรวจว่าข้อมูลตั้งค่าทั้ง 4 ช่องถูกบันทึกและอ่านกลับได้จริง
  const settings = {
    name: 'New shop updated',
    description: 'Updated business description',
    opening_hours: '10:00-17:00',
    persona: 'ตอบสุภาพและกระชับ',
  };
  const updated = await request('PATCH', `/api/v1/shops/${id}`, settings, coffee);
  assert.deepEqual(
    Object.fromEntries(Object.keys(settings).map(key => [key, updated.payload.data[key]])),
    settings,
  );
  const loaded = await request('GET', `/api/v1/shops/${id}`, undefined, coffee);
  assert.equal(loaded.payload.data.member_role, 'owner');
  assert.deepEqual(
    Object.fromEntries(Object.keys(settings).map(key => [key, loaded.payload.data[key]])),
    settings,
  );
  const listed = await request('GET', '/api/v1/shops?limit=1&offset=0', undefined, coffee);
  assert.equal(listed.payload.data.length, 1);
  assert.equal(listed.payload.data[0].member_role, 'owner');
  assert.equal(listed.payload.meta.total, 2);
});

test('AI preview shows only this shop data, evidence and prompt', async () => {
  const preview = await request('POST', '/api/v1/shops/shop-coffee/ai/preview',
    { question: 'ร้านเปิดกี่โมงครับ' }, coffee);
  assert.equal(preview.status, 200);
  assert.equal(preview.payload.data.shop.name, 'บ้านกาแฟ');
  assert.equal(typeof preview.payload.data.aiConfigured, 'boolean');
  assert.ok(preview.payload.data.sources.length);
  assert.ok(preview.payload.data.sources.every(source => source.chunkId.startsWith('shop-coffee')));
  assert.ok(preview.payload.data.prompt.messages[0].content.includes('หลักฐาน'));
  assert.equal((await request('POST', '/api/v1/shops/shop-flower/ai/preview',
    { question: 'ร้านขายอะไร' }, coffee)).status, 404);
  assert.equal((await request('POST', '/api/v1/shops/shop-coffee/ai/preview',
    { question: '' }, coffee)).status, 422);
});

test('all tenant routes reject the other shop; resource IDs cannot be mixed between shops', async () => {
  const shopList = await request('GET', '/api/v1/shops', undefined, flower);
  assert.deepEqual(shopList.payload.data.map(shop => shop.id), ['shop-flower']);
  for (const route of routes.filter(r => r.path.includes('{shopId}'))) {
    const path = route.path.replace('{shopId}', 'shop-flower').replace('{knowledgeId}', 'shop-flower-kb-1').replace('{conversationId}', 'shop-flower-conversation-1');
    assert.equal((await request(route.method, path, route.body ? {} : undefined, coffee)).status, 404, route.operationId);
  }
  for (const path of ['/knowledge/shop-flower-kb-1', '/conversations/shop-flower-conversation-1', '/conversations/shop-flower-conversation-1/messages']) {
    assert.equal((await request('GET', `/api/v1/shops/shop-coffee${path}`, undefined, coffee)).status, 404);
  }
  assert.equal((await request('POST', '/api/v1/shops/shop-coffee/conversations/shop-flower-conversation-1/messages', { role: 'customer', content: 'mixed tenant' }, coffee)).status, 404);
  const knowledge = await request('GET', '/api/v1/shops/shop-coffee/knowledge', undefined, coffee);
  assert.equal(knowledge.payload.meta.total, 3);
  assert.ok(knowledge.payload.data.every(row => row.shop_id === 'shop-coffee'));
});

test('knowledge CRUD and agent role boundaries', async () => {
  const base = '/api/v1/shops/shop-coffee/knowledge';
  const created = await request('POST', base, { kind: 'faq', title: 'Test FAQ', content: 'Answer', status: 'draft' }, coffee);
  assert.equal(created.status, 201);
  const path = `${base}/${created.payload.data.id}`;
  assert.equal((await request('GET', path, undefined, coffee)).payload.data.created_by, 'user-coffee');
  assert.equal((await request('PATCH', path, { status: 'published' }, coffee)).payload.data.status, 'published');
  assert.equal((await request('DELETE', path, undefined, coffee)).status, 204);
  assert.equal((await request('GET', path, undefined, coffee)).status, 404);
  db.prepare("INSERT INTO shop_memberships VALUES ('shop-coffee','user-flower','agent',?)").run(new Date().toISOString());
  try {
    assert.equal((await request('GET', '/api/v1/shops/shop-coffee', undefined, flower)).payload.data.member_role, 'agent');
    const agentShops = (await request('GET', '/api/v1/shops', undefined, flower)).payload.data;
    assert.equal(agentShops.find(shop => shop.id === 'shop-coffee').member_role, 'agent');
    assert.equal((await request('GET', base, undefined, flower)).status, 200);
    assert.equal((await request('POST', base, { kind: 'faq', title: 'T', content: 'C', status: 'draft' }, flower)).status, 403);
    assert.equal((await request('PATCH', '/api/v1/shops/shop-coffee', { name: 'Changed' }, flower)).status, 403);
  } finally { db.prepare("DELETE FROM shop_memberships WHERE shop_id = 'shop-coffee' AND user_id = 'user-flower'").run(); }
});

test('conversation lifecycle, message persistence and handover guard', async () => {
  const base = '/api/v1/shops/shop-coffee/conversations';
  const created = await request('POST', base, { channel: 'line', customer_external_id: 'test-line-user', customer_name: 'ทดสอบ' }, coffee);
  assert.equal(created.status, 201);
  const path = `${base}/${created.payload.data.id}`;
  assert.equal((await request('GET', path, undefined, coffee)).payload.data.bot_mode, 'active');
  assert.equal((await request('POST', `${path}/messages`, { role: 'agent', content: 'Hello' }, coffee)).payload.error.code, 'BOT_ACTIVE');
  assert.equal((await request('POST', `${path}/messages`, { role: 'customer', content: 'สวัสดี' }, coffee)).status, 201);
  await request('PATCH', path, { bot_mode: 'human' }, coffee);
  const reply = await request('POST', `${path}/messages`, { role: 'agent', content: 'ยินดีให้บริการ' }, coffee);
  assert.equal(reply.payload.data.author_user_id, 'user-coffee');
  const messages = await request('GET', `${path}/messages`, undefined, coffee);
  assert.equal(messages.payload.meta.total, 2);
  assert.deepEqual(messages.payload.data.map(message => message.role), ['customer', 'agent']);
  await request('PATCH', path, { status: 'closed' }, coffee);
  assert.equal((await request('POST', `${path}/messages`, { role: 'customer', content: 'Again' }, coffee)).payload.error.code, 'CONVERSATION_CLOSED');
  await request('PATCH', path, { status: 'open', bot_mode: 'active' }, coffee);
  assert.equal((await request('GET', base, undefined, coffee)).payload.meta.total, 2);
});

test('LINE channel configuration, webhook verification, deduplication and message simulation', async () => {
  const configPath = '/api/v1/shops/shop-coffee/line/config';
  const initial = await request('GET', configPath, undefined, coffee);
  assert.equal(initial.status, 200);
  assert.equal(initial.payload.data.configured, false);

  const secret = 'test-secret-123456';
  const token = 'test-token-1234567890';
  const updated = await request('PUT', configPath, { channel_secret: secret, channel_access_token: token, channel_id: 'coffee-line' }, coffee);
  assert.equal(updated.status, 200);
  assert.equal(updated.payload.data.configured, true);
  assert.equal(updated.payload.data.channel_id, 'coffee-line');
  assert.match(updated.payload.data.channel_secret_masked, /\*+3456/);
  const verifyPath = '/api/v1/shops/shop-coffee/line/verify';
  const checked = await request('POST', verifyPath,
    { webhook_url: 'https://example.com/api/v1/shops/shop-coffee/line/webhook' }, coffee);
  assert.equal(checked.payload.data.status, 'connected');
  assert.equal(checked.payload.data.bot_display_name, 'Coffee Bot');
  assert.equal((await request('POST', verifyPath, { webhook_url: 'https://example.com/api/v1/shops/shop-flower/line/webhook' }, coffee)).status, 422);
  assert.equal((await request('POST', verifyPath, { webhook_url: 'https://example.com/api/v1/shops/shop-coffee/line/webhook' }, flower)).status, 404);
  const partial = await request('PUT', configPath, { channel_id: 'coffee-line-updated' }, coffee);
  assert.equal(partial.status, 200);
  assert.equal(partial.payload.data.channel_id, 'coffee-line-updated');
  assert.equal(partial.payload.data.channel_secret_masked, updated.payload.data.channel_secret_masked);
  assert.equal(partial.payload.data.channel_access_token_masked, updated.payload.data.channel_access_token_masked);

  const webhookPath = '/api/v1/shops/shop-coffee/line/webhook';
  const webhookBody = {
    destination: 'U_COFFEE_BOT',
    events: [{
      type: 'message',
      webhookEventId: 'test-event-1',
      source: { type: 'user', userId: 'line-user-99' },
      message: { type: 'text', id: 'msg-1', text: 'สวัสดี มีกาแฟอะไรบ้าง' },
      replyToken: 'dummy-reply-token',
      timestamp: Date.now(),
    }],
  };
  const rawBody = JSON.stringify(webhookBody);
  const signature = createHmac('sha256', secret).update(rawBody).digest('base64');
  const whRes = await request('POST', webhookPath, webhookBody, null, { headers: { 'x-line-signature': signature } });
  assert.equal(whRes.status, 200);
  assert.equal(whRes.payload.data.status, 'ok');
  assert.equal(whRes.payload.data.processed_count, 1);

  const whDup = await request('POST', webhookPath, webhookBody, null, { headers: { 'x-line-signature': signature } });
  assert.equal(whDup.status, 200);
  assert.equal(whDup.payload.data.processed_count, 0);

  const simPath = '/api/v1/shops/shop-coffee/line/simulate';
  const simRes = await request('POST', simPath, { user_id: 'line-user-99', text: 'ขอเมนูหน่อยครับ' }, coffee);
  assert.equal(simRes.status, 200);
  assert.equal(simRes.payload.data.status, 'processed');
  assert.equal(simRes.payload.data.replied, true);
  assert.ok(simRes.payload.data.conversation_id);
  const sourced = await request('POST', simPath, { user_id: 'line-user-100', text: 'ร้านเปิดกี่โมงครับ' }, coffee);
  assert.deepEqual(sourced.payload.data.reply_source_ids, ['shop-coffee-kb-1']);
  assert.equal(sourced.payload.data.reply_method, 'faq');
  const retrieved = await request('POST', simPath, { user_id: 'line-user-101', text: 'ลาเต้เย็นราคาเท่าไหร่' }, coffee);
  assert.equal(retrieved.payload.data.reply_method, 'extractive');
  assert.deepEqual(retrieved.payload.data.reply_source_ids, ['shop-coffee-kb-2']);
});

test('database constraints reject cross-shop references even outside the API', () => {
  const insert = db.prepare('INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?)');
  assert.throws(() => insert.run('bad-message', 'shop-coffee', 'shop-flower-conversation-1', 'customer', 'bad', null, new Date().toISOString()), /FOREIGN KEY/);
  assert.throws(() => insert.run('bad-author', 'shop-coffee', 'shop-coffee-conversation-1', 'agent', 'bad', 'user-flower', new Date().toISOString()), /FOREIGN KEY/);
  assert.throws(() => insert.run('missing-author', 'shop-coffee', 'shop-coffee-conversation-1', 'agent', 'bad', null, new Date().toISOString()), /CHECK/);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});

test('invalid inputs, body size, protected fields, auth and query boundaries', async () => {
  assert.equal((await request('GET', '/api/v1/shops')).status, 401);
  for (const query of ['limit=0', 'limit=101', 'offset=-1', 'limit=1&limit=2', 'offset=9007199254740992', 'unknown=x', 'limit=1e1']) {
    assert.equal((await request('GET', `/api/v1/shops?${query}`, undefined, coffee)).status, 400);
  }
  for (const body of [{ name: ' ' }, { name: 'x', id: 'injected' }, [], null, { name: 123 }]) {
    assert.equal((await request('POST', '/api/v1/shops', body, coffee)).status, 422);
  }
  assert.equal((await request('PATCH', '/api/v1/shops/shop-coffee', {}, coffee)).status, 422);
  assert.equal((await request('POST', '/api/v1/shops', '{bad', coffee, { raw: true })).status, 400);
  assert.equal((await request('POST', '/api/v1/shops', {}, coffee, { headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await request('POST', '/api/v1/shops', { name: 'x'.repeat(140000) }, coffee)).status, 413);
  assert.equal((await request('POST', '/api/v1/shops/shop-coffee/conversations/shop-coffee-conversation-1/messages', { role: 'assistant', content: 'forged' }, coffee)).status, 422);
  assert.equal((await request('DELETE', '/api/v1/shops', undefined, coffee)).status, 405);
  assert.equal((await request('GET', '/api/v1/shops/%ZZ', undefined, coffee)).status, 400);
});

test('every declared endpoint has a successful HTTP contract check', () => {
  assert.deepEqual(routes.filter(route => !exercised.has(route.operationId)).map(route => route.operationId), []);
});

test('authentication throttling bounds repeated password attempts', async () => {
  let last;
  for (let i = 0; i < 21; i++) last = await request('POST', '/api/v1/auth/login', { email: 'missing@example.test', password: 'wrongPassword' });
  assert.equal(last.status, 429);
  assert.equal(last.headers.get('retry-after'), '60');
});
