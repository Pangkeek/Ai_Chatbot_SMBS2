import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createHmac } from 'node:crypto';
import { openDatabase } from '../src/lib/db.js';
import { seedDemo, demoPassword } from '../src/lib/seed.js';
import { createApp } from '../src/lib/app.js';
import { schemas } from '../src/lib/contracts.js';
import { validate } from '../src/utils/validation.js';
import { createLineWorker } from '../src/services/worker.js';

let db, server, base, token, worker;
const delivered = [];
async function request(path, auth = token, options = {}) {
  const response = await fetch(base + path, { ...options, headers: {
    ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers,
  } });
  return { status: response.status, body: await response.json() };
}
before(async () => {
  db = openDatabase(':memory:');
  await seedDemo(db);
  worker = createLineWorker(db, { sendReply: async payload => { delivered.push(payload); return { status: 'ok' }; }, logErrors: false });
  server = createApp(db, { logErrors: false, worker });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
  const login = await request('/api/v1/auth/login', null, { method: 'POST', body: JSON.stringify({ email: 'coffee@example.test', password: demoPassword }) });
  token = login.body.data.access_token;
});
after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); });

test('shop statistics count each room and message once and isolate tenants', async () => {
  const time = '2026-10-17T00:00:00.000Z';
  db.prepare('INSERT INTO conversations VALUES (?,?,?,?,?,?,?,?,?)').run('stats-human', 'shop-coffee', 'line', 'U-stats', 'แอดมิน', 'open', 'human', time, time);
  db.prepare('INSERT INTO conversations VALUES (?,?,?,?,?,?,?,?,?)').run('stats-closed', 'shop-coffee', 'web', 'W-stats', 'เว็บ', 'closed', 'paused', time, time);
  const insert = db.prepare('INSERT INTO messages VALUES (?,?,?,?,?,?,?)');
  insert.run('stats-agent', 'shop-coffee', 'stats-human', 'agent', 'รับช่วงแล้ว', 'user-coffee', time);
  insert.run('stats-customer', 'shop-coffee', 'stats-human', 'customer', 'ขอบคุณ', null, time);
  insert.run('stats-system', 'shop-coffee', 'stats-human', 'system', 'บันทึกระบบ', null, time);
  const result = await request('/api/v1/shops/shop-coffee/statistics');
  assert.equal(result.status, 200);
  assert.deepEqual(validate(result.body.data, schemas.ShopStatistics), []);
  const { generated_at, ...counts } = result.body.data;
  assert.ok(!Number.isNaN(Date.parse(generated_at)));
  assert.deepEqual(counts, {
    total_conversations: 3, open_conversations: 2, closed_conversations: 1,
    active_conversations: 1, paused_conversations: 1, human_conversations: 1,
    line_conversations: 1, web_conversations: 2,
    total_messages: 5, customer_messages: 2, assistant_messages: 1, agent_messages: 1, system_messages: 1,
  });
  assert.equal((await request('/api/v1/shops/shop-flower/statistics')).status, 404);
  assert.equal((await request('/api/v1/shops/shop-coffee/statistics', null)).status, 401);
  db.prepare("INSERT INTO shops VALUES ('empty-shop','Empty','','','',?,?)").run(time, time);
  db.prepare("INSERT INTO shop_memberships VALUES ('empty-shop','user-coffee','owner',?)").run(time);
  const empty = await request('/api/v1/shops/empty-shop/statistics');
  assert.equal(empty.status, 200);
  assert.ok(Object.entries(empty.body.data).every(([key, value]) => key === 'generated_at' || value === 0));
});

test('conversation filters apply before pagination and message order survives equal timestamps', async () => {
  const time = '2026-10-17T01:00:00.000Z';
  const insert = db.prepare('INSERT INTO conversations VALUES (?,?,?,?,?,?,?,?,?)');
  for (let index = 0; index < 105; index++) {
    insert.run(`page-${String(index).padStart(3, '0')}`, 'shop-coffee', 'line', `U-${index}`, 'ค้นหา 100%', 'open', 'human', time, time);
  }
  const basePath = '/api/v1/shops/shop-coffee/conversations';
  const query = '?search=100%25&channel=line&status=open&bot_mode=human&limit=10&offset=100';
  const result = await request(basePath + query);
  assert.equal(result.status, 200);
  assert.equal(result.body.meta.total, 105);
  assert.equal(result.body.data.length, 5);
  assert.deepEqual(result.body.data.map(row => row.id), ['page-004', 'page-003', 'page-002', 'page-001', 'page-000']);
  assert.ok(result.body.data.every(row => row.shop_id === 'shop-coffee' && row.message_count === 0 && row.last_message === null));
  assert.deepEqual(validate(result.body.data[0], schemas.ConversationSummary), []);
  assert.equal((await request(basePath + '?search=shop-flower')).body.meta.total, 0);
  for (const query of ['status=nope', 'bot_mode=nope', 'channel=nope', 'search=a&search=b', 'search=' + 'x'.repeat(201), 'unknown=1']) {
    assert.equal((await request(basePath + '?' + query)).status, 400, query);
  }
  const add = db.prepare('INSERT INTO messages VALUES (?,?,?,?,?,?,?)');
  add.run('z-first', 'shop-coffee', 'page-104', 'customer', '<img src=x onerror=alert(1)>', null, time);
  add.run('a-second', 'shop-coffee', 'page-104', 'assistant', 'ตอบจริง', null, time);
  const list = await request(basePath + '?search=U-104');
  assert.equal(list.body.data[0].last_message, 'ตอบจริง');
  assert.equal(list.body.data[0].message_count, 2);
  const messages = await request(basePath + '/page-104/messages?limit=1&offset=1');
  assert.equal(messages.body.meta.total, 2);
  assert.equal(messages.body.data[0].id, 'a-second');
  assert.equal((await request(basePath + '/shop-flower-conversation-1/messages')).status, 404);
});

test('signed LINE webhook history agrees with statistics and duplicate events do not inflate totals', async () => {
  const prefix = '/api/v1/shops/shop-coffee';
  const initial = (await request(prefix + '/statistics')).body.data;
  const secret = 'test-conversations-secret';
  assert.equal((await request(prefix + '/line/config', token, { method: 'PUT', body: JSON.stringify({ channel_secret: secret, channel_access_token: 'fake-test-token-only' }) })).status, 200);
  const raw = JSON.stringify({ events: [{ type: 'message', webhookEventId: 'conversation-audit-line',
    replyToken: 'test-reply-token', source: { type: 'user', userId: 'U-conversation-audit' },
    message: { type: 'text', id: 'test-audit-message', text: 'ร้านเปิดกี่โมงครับ' } }] });
  const signature = createHmac('sha256', secret).update(raw).digest('base64');
  const send = () => request(prefix + '/line/webhook', null, { method: 'POST', body: raw, headers: { 'x-line-signature': signature } });
  assert.equal((await send()).body.data.processed_count, 1);
  await worker.drain();
  assert.equal(delivered.length, 1);
  const rooms = await request(prefix + '/conversations?search=U-conversation-audit');
  assert.equal(rooms.body.meta.total, 1);
  const messages = await request(prefix + '/conversations/' + rooms.body.data[0].id + '/messages');
  assert.deepEqual(messages.body.data.map(row => row.role), ['customer', 'assistant']);
  assert.equal(messages.body.data[0].content, 'ร้านเปิดกี่โมงครับ');
  assert.equal(messages.body.data[1].content, delivered[0].messages[0].text);
  const stats = (await request(prefix + '/statistics')).body.data;
  assert.equal(stats.total_conversations, initial.total_conversations + 1);
  assert.equal(stats.total_messages, initial.total_messages + 2);
  assert.equal(stats.line_conversations, initial.line_conversations + 1);
  assert.equal((await send()).body.data.processed_count, 0);
  await worker.drain();
  assert.equal((await request(prefix + '/statistics')).body.data.total_messages, stats.total_messages);
  assert.equal(delivered.length, 1);
});
