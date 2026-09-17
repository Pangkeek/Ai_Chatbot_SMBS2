import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { openDatabase } from '../src/db.mjs';
import { seedDemo } from '../src/seed.mjs';
import { verifyLineSignature, sendLineReply, generateDefaultReply } from '../src/line.mjs';
import { createLineWorker } from '../src/worker.mjs';
import { createService } from '../src/service.mjs';

let db;

before(async () => {
  db = openDatabase(':memory:');
  await seedDemo(db);
});

after(async () => {
  await new Promise(resolve => setTimeout(resolve, 50));
  db.close();
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
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(result.conversationId);
  assert.equal(conv.shop_id, 'shop-coffee');
  assert.equal(conv.channel, 'line');
  assert.equal(conv.customer_external_id, 'line-cust-1');

  // Verify messages in DB (customer then assistant)
  const msgs = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at').all(result.conversationId);
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
  const msgs2 = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at').all(result.conversationId);
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
  db.prepare(`INSERT INTO conversations VALUES (?, 'shop-coffee', 'line', 'line-cust-human', 'User Human', 'open', 'human', ?, ?)`).run(convId, new Date().toISOString(), new Date().toISOString());

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
  const msgs = db.prepare('SELECT * FROM messages WHERE conversation_id = ?').all(convId);
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].role, 'customer');
  assert.equal(msgs[0].content, 'ต้องการคุยกับเจ้าหน้าที่');
});

test('service.lineWebhook deduplication drops replayed events and rejects invalid signatures', async () => {
  const secret = 'sec-dedup-test';
  const service = createService(db);

  // Setup channel
  service.updateLineConfig({
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
  assert.throws(() => {
    service.lineWebhook({
      params: { shopId: 'shop-flower' },
      body: eventPayload,
      rawBody,
      headers: { 'x-line-signature': 'bad-sig' },
    });
  }, /Invalid LINE webhook signature/);

  // 2. First valid delivery
  const validSig = createHmac('sha256', secret).update(rawBody).digest('base64');
  const res1 = service.lineWebhook({
    params: { shopId: 'shop-flower' },
    body: eventPayload,
    rawBody,
    headers: { 'x-line-signature': validSig },
  });
  assert.equal(res1.data.processed_count, 1);

  // 3. Replayed webhook (same eventId) -> deduplicated, processed_count = 0
  const res2 = service.lineWebhook({
    params: { shopId: 'shop-flower' },
    body: eventPayload,
    rawBody,
    headers: { 'x-line-signature': validSig },
  });
  assert.equal(res2.data.processed_count, 0);
});
