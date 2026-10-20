import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { withTestSchema } from '../integration/postgresql-fixture.js';
import { migratePostgresql } from '../scripts/postgresql/migrations.js';
import { seedDemo } from '../src/lib/seed.js';
import { createLineWorker } from '../src/services/worker.js';
import { createAiGateway } from '../src/services/ai/gateway.js';
import { loadConversationHistory } from '../src/services/ai/conversation.js';
import { recordLineEvents } from '../src/services/lineJobs.js';
import { transaction } from '../src/lib/db.js';
import { createService } from '../src/services/service.js';

const gateway = generate => createAiGateway({ providers: [{ name: 'fixture', generate }], maxRetries: 0, log() {} });
const social = { intent: 'conversation', replyText: 'สวัสดีครับ ต้องการให้ช่วยอะไรครับ', resolvedQuestion: '' };
async function fixture(run) {
  return withTestSchema(async ({ db, config }) => {
    await migratePostgresql({ config }); await seedDemo(db);
    await db.query(`INSERT INTO line_channels(shop_id,channel_secret,channel_access_token,created_at,updated_at)
      SELECT id,'fixture-secret','fixture-token',now(),now() FROM shops`);
    await run(db);
  });
}

test('real message history is limited to ten prior messages in the same shop and conversation', () => fixture(async db => {
  const worker = createLineWorker(db, { generator: null, logErrors: false });
  const send = (shopId, user) => worker.handleMessageEvent({ shopId, simulated: true,
    event: { source: { userId: user }, message: { text: 'สวัสดี' } } });
  const room = await send('shop-coffee', 'history-a');
  const other = await send('shop-coffee', 'history-b');
  const foreign = await send('shop-flower', 'history-a');
  await db.query('DELETE FROM messages WHERE conversation_id=$1', [room.conversationId]);
  for (let i = 0; i < 14; i++) {
    await db.query(`INSERT INTO messages(id,shop_id,conversation_id,role,content,created_at)
      VALUES($1,'shop-coffee',$2,'customer',$3,$4)`,
    [`history-${i}`, room.conversationId, `${i}: ${'ก'.repeat(1100)}`, new Date(2026, 0, 1, 0, 0, i).toISOString()]);
  }
  const history = await loadConversationHistory(db, { shopId: 'shop-coffee', conversationId: room.conversationId, currentMessageId: 'history-12' });
  assert.equal(history.length, 10);
  assert.match(history[0].content, /^2:/);
  assert.match(history[9].content, /^11:/);
  assert.ok(history.every(row => row.content.length === 1000 && row.role === 'customer'));
  for (const [shopId, conversationId, currentMessageId] of [
    ['shop-flower', room.conversationId, 'history-12'],
    ['shop-coffee', other.conversationId, 'history-12'],
    ['shop-coffee', room.conversationId, foreign.customerMsgId],
  ]) assert.deepEqual(await loadConversationHistory(db, { shopId, conversationId, currentMessageId }), []);
}));

test('simulator uses previous customer details and stores evidence only for grounded replies', () => fixture(async db => {
  let turns = 0;
  const generator = gateway(async ({ task, prompt, context }) => {
    if (task !== 'conversation') return { text: context[0].content, sourceChunkIds: [context[0].chunkId], insufficient: false };
    const data = JSON.parse(prompt.messages[1].content);
    if (++turns === 1) return { intent: 'clarification', replyText: 'อยากทราบเรื่องไหนเกี่ยวกับกาแฟครับ', resolvedQuestion: '' };
    assert.ok(data.history.some(row => row.content === 'สนใจกาแฟครับ'));
    assert.ok(!data.history.some(row => row.content === data.customerMessage));
    return { intent: 'business', replyText: '', resolvedQuestion: 'ร้านเปิดกี่โมง' };
  });
  const worker = createLineWorker(db, { generator, logErrors: false });
  const send = text => worker.handleMessageEvent({ shopId: 'shop-coffee', simulated: true,
    event: { source: { userId: 'context-test' }, message: { text } } });
  const first = await send('สนใจกาแฟครับ');
  assert.equal(first.replyMethod, 'clarification'); assert.deepEqual(first.sourceKnowledgeIds, []);
  assert.equal((await db.query('SELECT * FROM message_sources WHERE message_id=$1', [first.replyMsgId])).rowCount, 0);
  const second = await send('แล้วเปิดกี่โมง');
  assert.ok(second.sourceKnowledgeIds.length);
  assert.ok((await db.query('SELECT * FROM message_sources WHERE message_id=$1', [second.replyMsgId])).rowCount);
  const service = createService(db, { worker: { wake() {} }, workerOptions: { generator: null } });
  await service.updateConversation({ params: { shopId: 'shop-coffee', conversationId: first.conversationId }, body: { bot_mode: 'human' } });
  assert.equal((await send('ขอบคุณ')).replied, false);
}));

test('durable worker checkpoints conversation fallback once after invalid output or timeout', () => fixture(async db => {
  for (const generate of [async () => ({ invalid: true }), async () => new Promise(() => {})]) {
    const eventId = randomUUID();
    const event = { type: 'message', webhookEventId: eventId, replyToken: 'fixture',
      source: { userId: eventId }, message: { type: 'text', text: 'ขอบคุณครับ' } };
    await transaction(db, tx => recordLineEvents(tx, 'shop-coffee', [event]));
    let sent = 0;
    const generator = createAiGateway({ providers: [{ name: 'fixture', generate }], attemptTimeoutMs: 10, maxRetries: 0, log() {} });
    const worker = createLineWorker(db, { generator, logErrors: false, sendReply: async () => { sent++; } });
    await worker.runOnce(); await worker.runOnce();
    const saved = (await db.query('SELECT * FROM line_jobs WHERE event_id=$1', [eventId])).rows[0];
    assert.equal(saved.status, 'completed'); assert.equal(saved.reply_method, 'conversation_fallback');
    assert.equal(sent, 1); assert.equal(saved.reply_text, 'ยินดีครับ');
    assert.equal((await db.query('SELECT * FROM message_sources WHERE message_id=$1', [saved.reply_message_id])).rowCount, 0);
  }
}));

test('manual takeover while the conversation model is running prevents durable delivery', () => fixture(async db => {
  const eventId = randomUUID();
  await transaction(db, tx => recordLineEvents(tx, 'shop-coffee', [{ type: 'message', webhookEventId: eventId,
    replyToken: 'fixture', source: { userId: eventId }, message: { type: 'text', text: 'สวัสดี' } }]));
  const generator = gateway(async () => {
    await db.query(`UPDATE conversations SET bot_mode='human' WHERE shop_id='shop-coffee' AND customer_external_id=$1`, [eventId]);
    return social;
  });
  const worker = createLineWorker(db, { generator, logErrors: false, sendReply: async () => assert.fail('reply after takeover') });
  await worker.runOnce();
  const saved = (await db.query('SELECT * FROM line_jobs WHERE event_id=$1', [eventId])).rows[0];
  assert.equal(saved.delivery_state, 'pending'); assert.equal(saved.reply_message_id, null);
}));
