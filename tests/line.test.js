import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createTestDatabase } from '../integration/postgresql-fixture.js';
import { migratePostgresql } from '../scripts/postgresql/migrations.js';
import { seedDemo } from '../src/lib/seed.js';
import { verifyLineSignature, checkLineConnection, sendLineReply, generateDefaultReply } from '../src/services/line.js';
import { createLineWorker } from '../src/services/worker.js';
import { createService } from '../src/services/service.js';

let db, fixture;

before(async () => {
  fixture = await createTestDatabase();
  db = fixture.db;
  await migratePostgresql({ config: fixture.config });
  await seedDemo(db);
  await createService(db).updateLineConfig({ params: { shopId: 'shop-coffee' }, body: {
    channel_secret: 'test-secret', channel_access_token: 'test-token',
  } });
});

after(async () => {
  await fixture?.dispose();
});

test('verifyLineSignature validates correct HMAC-SHA256 and rejects forgery', () => {
  const secret = 'my-line-secret-key';
  const body = JSON.stringify({ events: [{ type: 'message' }] });
  const validSig = createHmac('sha256', secret).update(body).digest('base64');

  assert.equal(verifyLineSignature(body, validSig, secret), true);
  assert.equal(verifyLineSignature(Buffer.from(body), validSig, secret), true);
  assert.equal(verifyLineSignature(body + 'tampered', validSig, secret), false);
  assert.equal(verifyLineSignature(body, 'bad-signature', secret), false);
  assert.equal(verifyLineSignature(body, validSig, 'wrong-secret'), false);
  assert.equal(verifyLineSignature(null, validSig, secret), false);
  assert.equal(verifyLineSignature(body, null, secret), false);
});

test('LINE connection check validates token and the actual webhook test result', async () => {
  const webhookUrl = 'https://example.com/api/v1/shops/shop-coffee/line/webhook';
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/info')) return new Response(JSON.stringify({ displayName: 'Coffee Bot' }), { status: 200 });
    if (url.endsWith('/endpoint')) return new Response(JSON.stringify({ endpoint: webhookUrl, active: true }), { status: 200 });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };
  const connected = await checkLineConnection({ channelAccessToken: 'valid-token', expectedWebhookUrl: webhookUrl, fetchImpl });
  assert.equal(connected.status, 'connected');
  assert.equal(connected.token_valid, true);
  assert.equal(connected.webhook_reachable, true);
  assert.equal(connected.bot_display_name, 'Coffee Bot');
  assert.equal(calls.length, 3);
  assert.equal(calls[2].options.method, 'POST');

  calls.length = 0;
  const mismatch = await checkLineConnection({ channelAccessToken: 'valid-token', expectedWebhookUrl: webhookUrl + '-wrong', fetchImpl });
  assert.equal(mismatch.status, 'webhook_mismatch');
  assert.equal(calls.length, 2);

  const invalid = await checkLineConnection({ channelAccessToken: 'bad-token', expectedWebhookUrl: webhookUrl,
    fetchImpl: async () => new Response('', { status: 401 }) });
  assert.equal(invalid.status, 'token_invalid');
  assert.equal(invalid.token_valid, false);

  const failedWebhook = await checkLineConnection({ channelAccessToken: 'valid-token', expectedWebhookUrl: webhookUrl,
    fetchImpl: async (url) => url.endsWith('/info')
      ? new Response('{}', { status: 200 })
      : url.endsWith('/endpoint')
        ? new Response(JSON.stringify({ endpoint: webhookUrl, active: true }), { status: 200 })
        : new Response(JSON.stringify({ success: false, statusCode: 401 }), { status: 200 }) });
  assert.equal(failedWebhook.status, 'webhook_failed');
  assert.equal(failedWebhook.webhook_reachable, false);
});

test('failed LINE delivery is not recorded as a sent assistant message', async () => {
  const worker = createLineWorker(db, { sendReply: async () => { throw new Error('LINE rejected'); }, logErrors: false });
  const result = await worker.handleMessageEvent({
    shopId: 'shop-coffee',
    channelConfig: { channel_access_token: 'bad-token' },
    event: { type: 'message', webhookEventId: 'evt-delivery-failed', replyToken: 'reply-failed',
      source: { userId: 'line-cust-failed' }, message: { type: 'text', text: 'hello' } },
  });
  assert.equal(result.replied, false);
  assert.equal(result.replyMsgId, undefined);
  const messages = (await db.query('SELECT role FROM messages WHERE conversation_id = $1', [result.conversationId])).rows;
  assert.deepEqual(messages.map(message => message.role), ['customer']);
});

test('generateDefaultReply includes shop name and polite phrasing', () => {
  const reply = generateDefaultReply({
    shop: { name: 'ร้านกาแฟเพื่อนบ้าน', opening_hours: '08:00 - 17:00' },
    messageText: 'มีเอสเพรสโซ่ไหมครับ',
  });
  assert.match(reply, /ร้านกาแฟเพื่อนบ้าน/);
  assert.match(reply, /มีเอสเพรสโซ่ไหมครับ/);
});

test('LINE worker creates conversation, persists messages, and handles reply', async () => {
  const repliesSent = [];
  const mockSender = async (params) => {
    repliesSent.push(params);
    return { status: 'ok' };
  };

  const worker = createLineWorker(db, { sendReply: mockSender, logErrors: false });

  // 1. Process customer message
  const result = await worker.handleMessageEvent({
    shopId: 'shop-coffee',
    channelConfig: { channel_access_token: 'dummy-token' },
    event: {
      type: 'message',
      webhookEventId: 'evt-worker-1',
      replyToken: 'tok-1',
      source: { userId: 'line-cust-1' },
      message: { type: 'text', text: 'เปิดกี่โมงครับ' },
    },
  });

  assert.equal(result.replied, true);
  assert.ok(result.conversationId);
  assert.ok(result.customerMsgId);
  assert.ok(result.replyMsgId);
  assert.equal(repliesSent.length, 1);
  assert.equal(repliesSent[0].replyToken, 'tok-1');

  // Verify conversation in DB
  const conv = (await db.query('SELECT * FROM conversations WHERE id = $1', [result.conversationId])).rows[0];
  assert.equal(conv.shop_id, 'shop-coffee');
  assert.equal(conv.channel, 'line');
  assert.equal(conv.customer_external_id, 'line-cust-1');

  // Verify messages in DB (customer then assistant)
  const msgs = (await db.query('SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at', [result.conversationId])).rows;
  assert.equal(msgs.length, 2);
  assert.equal(msgs[0].role, 'customer');
  assert.equal(msgs[0].content, 'เปิดกี่โมงครับ');
  assert.equal(msgs[1].role, 'assistant');
  assert.match(msgs[1].content, /เปิดกี่โมงครับ/);

  // 2. Second message from same user reuses the same conversation
  const result2 = await worker.handleMessageEvent({
    shopId: 'shop-coffee',
    channelConfig: { channel_access_token: 'dummy-token' },
    event: {
      type: 'message',
      webhookEventId: 'evt-worker-2',
      replyToken: 'tok-2',
      source: { userId: 'line-cust-1' },
      message: { type: 'text', text: 'มีที่จอดรถไหม' },
    },
  });

  assert.equal(result2.conversationId, result.conversationId);
  const msgs2 = (await db.query('SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at', [result.conversationId])).rows;
  assert.equal(msgs2.length, 4);
});

test('LINE worker respects bot_mode paused / human (Handover Guard)', async () => {
  const repliesSent = [];
  const worker = createLineWorker(db, {
    sendReply: async (p) => { repliesSent.push(p); },
    logErrors: false,
  });

  // Create conversation and set bot_mode to 'human'
  const convId = 'conv-human-mode';
  (await db.query(`INSERT INTO conversations (id,shop_id,channel,customer_external_id,customer_name,status,bot_mode,created_at,updated_at) VALUES ($1, 'shop-coffee', 'line', 'line-cust-human', 'User Human', 'open', 'human', $2, $3)`, [convId, new Date().toISOString(), new Date().toISOString()]));

  const result = await worker.handleMessageEvent({
    shopId: 'shop-coffee',
    channelConfig: { channel_access_token: 'dummy-token' },
    event: {
      type: 'message',
      webhookEventId: 'evt-human-1',
      replyToken: 'tok-human',
      source: { userId: 'line-cust-human' },
      message: { type: 'text', text: 'ต้องการคุยกับเจ้าหน้าที่' },
    },
  });

  assert.equal(result.replied, false);
  assert.equal(result.reason, 'human');
  assert.equal(repliesSent.length, 0);

  // Customer message is still safely stored
  const msgs = (await db.query('SELECT * FROM messages WHERE conversation_id = $1', [convId])).rows;
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].role, 'customer');
  assert.equal(msgs[0].content, 'ต้องการคุยกับเจ้าหน้าที่');
});

test('service.lineWebhook deduplication drops replayed events and rejects invalid signatures', async () => {
  const secret = 'sec-dedup-test';
  const service = createService(db, { workerOptions: { sendReply: async () => ({ status: 'ok' }), logErrors: false } });

  // Setup channel
  await service.updateLineConfig({
    params: { shopId: 'shop-flower' },
    body: { channel_secret: secret, channel_access_token: 'token-flower' },
  });

  const eventPayload = {
    destination: 'U_FLOWER_BOT',
    events: [{
      type: 'message',
      webhookEventId: 'evt-dedup-unique-123',
      source: { type: 'user', userId: 'cust-flower-1' },
      message: { type: 'text', id: 'm123', text: 'มีดอกกุหลาบไหม' },
      replyToken: 'tok-flower-1',
      timestamp: Date.now(),
    }],
  };
  const rawBody = JSON.stringify(eventPayload);

  // 1. Invalid signature rejection
  await assert.rejects(async () => {
    await service.lineWebhook({
      params: { shopId: 'shop-flower' },
      body: eventPayload,
      rawBody,
      headers: { 'x-line-signature': 'bad-sig' },
    });
  }, /Invalid LINE webhook signature/);

  // 2. First valid delivery
  const validSig = createHmac('sha256', secret).update(rawBody).digest('base64');
  const res1 = await service.lineWebhook({
    params: { shopId: 'shop-flower' },
    body: eventPayload,
    rawBody,
    headers: { 'x-line-signature': validSig },
  });
  assert.equal(res1.data.processed_count, 1);

  // 3. Replayed webhook (same eventId) -> deduplicated, processed_count = 0
  const res2 = await service.lineWebhook({
    params: { shopId: 'shop-flower' },
    body: eventPayload,
    rawBody,
    headers: { 'x-line-signature': validSig },
  });
  assert.equal(res2.data.processed_count, 0);
  await service.worker.drain();
});
