import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { withTestSchema } from '../integration/postgresql-fixture.js';
import { migratePostgresql } from '../scripts/postgresql/migrations.js';
import { seedDemo } from '../src/lib/seed.js';
import { transaction } from '../src/lib/db.js';
import { createLineWorker } from '../src/services/worker.js';
import { createService } from '../src/services/service.js';
import { recordLineEvents } from '../src/services/lineJobs.js';
import { answerQuestion } from '../src/services/rag.js';
import { createAiGateway, AiError } from '../src/services/ai/gateway.js';
import { claimHandover, handoverAnswer } from '../src/services/ai/handover.js';
import { validate } from '../src/utils/validation.js';
import { schemas } from '../src/lib/contracts.js';
import { serializeDates } from '../src/lib/postgresql-schema.js';

const provider = (name, generate) => ({ name, model: 'fixture', generate });
const gateway = providers => createAiGateway({ providers, maxRetries: 0, log() {} });
const failedGateway = () => gateway(['gemini', 'openai'].map(name => provider(name, async () => { throw new AiError('AI_HTTP_401'); })));
const event = (overrides = {}) => ({ type: 'message', webhookEventId: randomUUID(), replyToken: 'fixture-reply',
  source: { userId: 'fixture-user' }, message: { type: 'text', text: 'ค่าจัดส่งเท่าไร' }, ...overrides });
const makeWorker = (db, options = {}) => createLineWorker(db, { generator: failedGateway(), sendReply: async () => {}, logErrors: false, ...options });
async function fixture(run) {
  return withTestSchema(async ({ db, config }) => {
    await migratePostgresql({ config }); await seedDemo(db);
    await db.query(`INSERT INTO line_channels(shop_id,channel_secret,channel_access_token,created_at,updated_at)
      SELECT id,'fixture-secret','fixture-token',now(),now() FROM shops`);
    const enqueue = async (events, shopId = 'shop-flower') => transaction(db, tx => recordLineEvents(tx, shopId, events));
    const job = async id => (await db.query('SELECT * FROM line_jobs WHERE event_id=$1', [id])).rows[0];
    const conversation = async id => (await db.query('SELECT * FROM conversations WHERE shop_id=$1 AND id=$2', ['shop-flower', id])).rows[0];
    const service = createService(db, { worker: { wake() {} }, workerOptions: { generator: null } });
    await run({ db, config, enqueue, job, conversation, service });
  });
}

test('primary failure uses OpenAI with tenant-scoped evidence and durable source audit', () => fixture(async ({ db, enqueue, job, conversation }) => {
  let gemini = 0, openai = 0;
  const generator = gateway([provider('gemini', async () => { gemini++; throw new AiError('AI_HTTP_503'); }),
    provider('openai', async ({ context }) => {
      openai++;
      assert.ok(context.every(source => source.chunkId.startsWith('shop-flower')));
      return { text: context[0].content, sourceChunkIds: [context[0].chunkId], insufficient: false };
    })]);
  const e = event(); await enqueue([e]);
  let sent = 0;
  await makeWorker(db, { generator, sendReply: async () => { sent++; } }).runOnce();
  const saved = await job(e.webhookEventId);
  assert.equal(saved.status, 'completed'); assert.equal(saved.reply_method, 'generator'); assert.equal(sent, 1);
  assert.equal(gemini, 1); assert.equal(openai, 1);
  assert.equal((await conversation(saved.conversation_id)).bot_mode, 'active');
  const sources = (await db.query('SELECT * FROM message_sources WHERE message_id=$1', [saved.reply_message_id])).rows;
  assert.equal(sources.length, 1); assert.equal(sources[0].shop_id, 'shop-flower');
}));

test('both providers failing atomically hand over, notify once, and block subsequent bot replies', () => fixture(async ({ db, enqueue, job, conversation, service }) => {
  const e = event(); await enqueue([e]);
  const sent = [];
  const worker = makeWorker(db, { sendReply: async ({ messages }) => {
    const saved = await job(e.webhookEventId), state = await conversation(saved.conversation_id);
    assert.equal(state.bot_mode, 'human'); assert.equal(state.handover_reason, 'AI_UNAVAILABLE');
    assert.equal(state.handover_job_id, saved.job_id); assert.equal(saved.reply_method, 'handover');
    assert.equal(saved.bot_revision, state.bot_revision);
    sent.push(messages[0].text);
  } });
  await worker.runOnce();
  const saved = await job(e.webhookEventId);
  assert.equal(saved.delivery_state, 'sent'); assert.equal(saved.status, 'completed');
  assert.deepEqual(saved.reply_sources, []);
  assert.equal(sent[0], handoverAnswer('AI_UNAVAILABLE').text);
  const next = event(); await enqueue([e, next]); await worker.drain();
  assert.equal(sent.length, 1); assert.equal((await job(next.webhookEventId)).last_error_code, 'BOT_INACTIVE');
  const params = { shopId: 'shop-flower', conversationId: saved.conversation_id };
  const publicValue = (await service.getConversation({ params })).data;
  assert.equal(publicValue.handover_reason, 'AI_UNAVAILABLE'); assert.ok(!Object.hasOwn(publicValue, 'handover_job_id'));
  assert.deepEqual(validate(serializeDates(publicValue), schemas.Conversation), []);
  const listed = await service.listConversations({ params, query: { limit: 50, offset: 0 } });
  assert.ok(listed.data.every(row => !Object.hasOwn(row, 'handover_job_id')));
  await assert.rejects(service.getConversation({ params: { ...params, shopId: 'shop-coffee' } }), { status: 404 });
  await service.updateConversation({ params, body: { bot_mode: 'active' } });
  const resumed = await conversation(saved.conversation_id);
  assert.equal(resumed.handover_reason, null); assert.equal(resumed.handover_job_id, null);
}));

test('FAQ, no evidence and insufficient output never cause outage handover', () => fixture(async ({ db }) => {
  let calls = 0;
  const generator = gateway([provider('gemini', async () => { calls++; return { text: '', sourceChunkIds: [], insufficient: true }; })]);
  assert.equal((await answerQuestion(db, { shopId: 'shop-flower', query: 'ร้านเปิดกี่โมงครับ', generator })).method, 'faq');
  assert.equal((await answerQuestion(db, { shopId: 'shop-flower', query: 'มีที่จอดรถไหม', generator })).method, 'no_evidence');
  assert.equal(calls, 0);
  assert.equal((await answerQuestion(db, { shopId: 'shop-flower', query: 'ค่าจัดส่งเท่าไร', generator })).method, 'no_evidence');
  assert.equal(calls, 1);
  const legacy = await answerQuestion(db, { shopId: 'shop-flower', query: 'ค่าจัดส่งเท่าไร', generator: {
    generate: async () => { throw new Error('legacy unavailable'); },
  } });
  assert.equal(legacy.method, 'extractive');
}));

test('concurrent workers claim one handover and only its owner sends a notice', () => fixture(async ({ db, enqueue, job }) => {
  const events = [event(), event()]; await enqueue(events);
  let started = 0, release, bothStarted;
  const barrier = new Promise(resolve => { release = resolve; });
  const startedPromise = new Promise(resolve => { bothStarted = resolve; });
  const generator = { failurePolicy: 'handover', async generate() {
    if (++started === 2) bothStarted(); await barrier; throw new AiError('AI_UNAVAILABLE');
  } };
  let sends = 0;
  const workers = [makeWorker(db, { generator, sendReply: async () => { sends++; } }), makeWorker(db, { generator, sendReply: async () => { sends++; } })];
  const running = workers.map(worker => worker.runOnce());
  await startedPromise; release(); await Promise.all(running);
  assert.equal(sends, 1);
  const jobs = await Promise.all(events.map(e => job(e.webhookEventId)));
  assert.equal(jobs[0].conversation_id, jobs[1].conversation_id);
  assert.equal(jobs.filter(row => row.reply_method === 'handover').length, 1);
  assert.equal(jobs.filter(row => row.last_error_code === 'BOT_INACTIVE').length, 1);
}));

test('pre-send restart reuses persisted handover without regeneration; admin mode change invalidates stale notice', () => fixture(async ({ db, enqueue, job, conversation, service }) => {
  for (const manualMode of [null, 'active', 'human', 'paused', 'closed']) {
    const e = event({ source: { userId: `restart-${manualMode}` } }); await enqueue([e]);
    const interrupted = { ...db, async query(sql, params) {
      if (sql.startsWith('SELECT channel_access_token')) throw Object.assign(new Error('temporary DB failure'), { code: '40001' });
      return db.query(sql, params);
    } };
    await makeWorker(interrupted).runOnce();
    const saved = await job(e.webhookEventId);
    assert.equal(saved.reply_method, 'handover'); assert.equal(saved.status, 'pending');
    assert.equal((await conversation(saved.conversation_id)).bot_mode, 'human');
    if (manualMode) await service.updateConversation({ params: { shopId: 'shop-flower', conversationId: saved.conversation_id },
      body: manualMode === 'closed' ? { status: 'closed' } : { bot_mode: manualMode } });
    await db.query('UPDATE line_jobs SET available_at=clock_timestamp() WHERE job_id=$1', [saved.job_id]);
    let sends = 0;
    const generator = { failurePolicy: 'handover', async generate() { assert.fail('persisted handover was regenerated'); } };
    await makeWorker(db, { generator, sendReply: async () => { sends++; } }).runOnce();
    assert.equal(sends, manualMode ? 0 : 1);
    assert.equal((await job(e.webhookEventId)).status, 'completed');
    assert.equal((await conversation(saved.conversation_id)).handover_reason, manualMode ? null : 'AI_UNAVAILABLE');
  }
}));

test('human state persists when delivery fails or becomes uncertain; delivery is never retried', () => fixture(async ({ db, enqueue, job, conversation }) => {
  for (const code of ['LINE_HTTP_REJECTED', 'ECONNRESET']) {
    const e = event({ source: { userId: code } }); await enqueue([e]);
    let sends = 0;
    const worker = makeWorker(db, { sendReply: async () => { sends++; throw Object.assign(new Error('send failed'), { code }); } });
    await worker.runOnce();
    const saved = await job(e.webhookEventId);
    assert.equal(saved.status, code === 'LINE_HTTP_REJECTED' ? 'failed' : 'unknown');
    assert.equal((await conversation(saved.conversation_id)).bot_mode, 'human');
    await worker.drain(); assert.equal(sends, 1);
    assert.equal((await db.query('SELECT 1 FROM messages WHERE conversation_id=$1 AND role=$2', [saved.conversation_id, 'assistant'])).rowCount, 0);
  }
}));

test('missing LINE reply credentials retain human state without claiming a successful notice', () => fixture(async ({ db, enqueue, job, conversation }) => {
  const e = event({ replyToken: null }); await enqueue([e]);
  await makeWorker(db, { sendReply: async () => { assert.fail('missing reply token sent'); } }).runOnce();
  const saved = await job(e.webhookEventId);
  assert.equal(saved.status, 'failed'); assert.equal(saved.last_error_code, 'REPLY_CREDENTIAL_MISSING');
  assert.equal(saved.reply_message_id, null); assert.equal((await conversation(saved.conversation_id)).bot_mode, 'human');
}));

test('agent reply cancels an unsent handover notice and cannot overlap one already sending', () => fixture(async ({ db, enqueue, job, service }) => {
  const e = event(); await enqueue([e]);
  const interrupted = { ...db, async query(sql, params) {
    if (sql.startsWith('SELECT channel_access_token')) throw Object.assign(new Error('temporary DB failure'), { code: '40001' });
    return db.query(sql, params);
  } };
  await makeWorker(interrupted).runOnce();
  const saved = await job(e.webhookEventId);
  const params = { shopId: 'shop-flower', conversationId: saved.conversation_id };
  let pushes = 0;
  const agent = createService(db, { worker: { wake() {} }, workerOptions: { generator: null }, sendPush: async () => { pushes++; } });
  const result = await agent.sendAgentReply({ params, user: { id: 'user-flower' }, body: { request_id: randomUUID(), content: 'เจ้าหน้าที่รับช่วงแล้ว' } });
  assert.equal(result.data.status, 'sent'); assert.equal(pushes, 1);
  await db.query('UPDATE line_jobs SET available_at=clock_timestamp() WHERE job_id=$1', [saved.job_id]);
  await makeWorker(db, { sendReply: async () => assert.fail('old handover notice sent after agent reply') }).runOnce();
  assert.equal((await job(e.webhookEventId)).last_error_code, 'BOT_INACTIVE');

  await service.updateConversation({ params, body: { bot_mode: 'active' } });
  const next = event(); await enqueue([next]);
  await makeWorker(db, { sendReply: async () => {
    await assert.rejects(agent.sendAgentReply({ params, user: { id: 'user-flower' },
      body: { request_id: randomUUID(), content: 'รอข้อความแจ้งเสร็จก่อน' } }), { code: 'DELIVERY_IN_PROGRESS' });
  } }).runOnce();
  assert.equal(pushes, 1);
}));

test('safety refusal hands over directly without invoking OpenAI', () => fixture(async ({ db, enqueue, job, conversation }) => {
  let backups = 0;
  const generator = gateway([provider('gemini', async () => { throw new AiError('AI_SAFETY_REFUSAL'); }),
    provider('openai', async () => { backups++; })]);
  const e = event(); await enqueue([e]); await makeWorker(db, { generator }).runOnce();
  const saved = await job(e.webhookEventId);
  assert.equal(backups, 0); assert.equal((await conversation(saved.conversation_id)).handover_reason, 'AI_SAFETY_REFUSAL');
}));

test('admin pause/close during generation prevents handover and delivery', () => fixture(async ({ db, enqueue, job, service, conversation }) => {
  for (const changes of [[{ bot_mode: 'paused' }], [{ status: 'closed' }], [{ bot_mode: 'paused' }, { bot_mode: 'active' }]]) {
    const e = event({ source: { userId: randomUUID() } }); await enqueue([e]);
    const generator = { failurePolicy: 'handover', async generate() {
      const saved = await job(e.webhookEventId);
      for (const body of changes) await service.updateConversation({ params: { shopId: 'shop-flower', conversationId: saved.conversation_id }, body });
      throw new AiError('AI_UNAVAILABLE');
    } };
    await makeWorker(db, { generator, sendReply: async () => { assert.fail('inactive bot sent'); } }).runOnce();
    const saved = await job(e.webhookEventId);
    assert.equal(saved.last_error_code, 'BOT_INACTIVE');
    assert.equal((await conversation(saved.conversation_id)).handover_reason, null);
  }
}));

test('aged jobs reserve delivery time and hand over without making an AI HTTP call', () => fixture(async ({ db, enqueue, job, conversation }) => {
  const e = event(); await enqueue([e]);
  await db.query("UPDATE line_jobs SET received_at=clock_timestamp()-interval '34 seconds' WHERE event_id=$1", [e.webhookEventId]);
  const generator = gateway([provider('gemini', async () => { assert.fail('no AI budget left'); })]);
  await makeWorker(db, { generator }).runOnce();
  const saved = await job(e.webhookEventId);
  assert.equal(saved.delivery_state, 'sent'); assert.equal(saved.reply_method, 'handover');
  assert.equal((await conversation(saved.conversation_id)).bot_mode, 'human');
}));

test('expired reply window preserves handover, and expired lease blocks stale handover mutations', () => fixture(async ({ db, enqueue, job, conversation }) => {
  const e = event(); await enqueue([e]);
  const intercepted = { ...db, async query(sql, params) {
    if (sql.startsWith('SELECT channel_access_token')) {
      await db.query("UPDATE line_jobs SET received_at=clock_timestamp()-interval '46 seconds' WHERE event_id=$1", [e.webhookEventId]);
    }
    return db.query(sql, params);
  } };
  await makeWorker(intercepted, { sendReply: async () => { assert.fail('expired notice sent'); } }).runOnce();
  const saved = await job(e.webhookEventId);
  assert.equal(saved.last_error_code, 'REPLY_WINDOW_EXPIRED');
  assert.equal((await conversation(saved.conversation_id)).bot_mode, 'human');
  const other = event({ source: { userId: 'lease-test' } }); await enqueue([other]);
  const generator = { failurePolicy: 'handover', async generate() {
    const current = await job(other.webhookEventId);
    await db.query("UPDATE line_jobs SET lease_until=clock_timestamp()-interval '1 second',locked_at=clock_timestamp()-interval '2 seconds' WHERE job_id=$1", [current.job_id]);
    throw new AiError('AI_UNAVAILABLE');
  } };
  await makeWorker(db, { generator }).runOnce();
  const stale = await job(other.webhookEventId);
  assert.equal(stale.reply_text, null); assert.equal((await conversation(stale.conversation_id)).bot_mode, 'active');
}));

test('shutdown propagates cancellation, with no backup or handover after worker loses ownership', () => fixture(async ({ db, enqueue, job, conversation }) => {
  const e = event(); await enqueue([e]);
  let started; const ready = new Promise(resolve => { started = resolve; }); let backups = 0;
  const generator = gateway([provider('gemini', ({ signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true }); started();
  })), provider('openai', async () => { backups++; })]);
  const worker = makeWorker(db, { generator }); const pending = worker.runOnce(); await ready;
  await worker.stop({ timeoutMs: 1 }); await pending;
  const saved = await job(e.webhookEventId);
  assert.equal(backups, 0); assert.equal(saved.reply_text, null);
  assert.equal((await conversation(saved.conversation_id)).bot_mode, 'active');
}));

test('simulator applies handover once; database trigger invalidates notice for explicit admin edits', () => fixture(async ({ db, conversation, service }) => {
  const worker = makeWorker(db);
  const first = await worker.handleMessageEvent({ shopId: 'shop-flower', event: event(), simulated: true });
  assert.equal(first.replyMethod, 'handover'); assert.equal(first.replied, true);
  const second = await worker.handleMessageEvent({ shopId: 'shop-flower', event: event(), simulated: true });
  assert.equal(second.replied, false); assert.equal(second.reason, 'human');
  const params = { shopId: 'shop-flower', conversationId: first.conversationId };
  await service.updateConversation({ params, body: { bot_mode: 'human' } });
  assert.equal((await conversation(first.conversationId)).handover_job_id, null);
  await service.updateConversation({ params, body: { bot_mode: 'active' } });
  await transaction(db, async tx => {
    assert.equal(await claimHandover(tx, { shopId: 'shop-coffee', conversationId: first.conversationId,
      ownerId: 'wrong-shop', reason: 'AI_UNAVAILABLE' }), null);
  });
  assert.equal((await conversation(first.conversationId)).bot_mode, 'active');
}));

test('AI preview reflects dual configuration without calling AI or revealing credentials', () => fixture(async ({ service }) => {
  const values = { AI_MODE: 'dual', GEMINI_API_KEY: 'preview-gemini-secret', GEMINI_MODEL: 'fixture',
    OPENAI_API_KEY: 'preview-openai-secret', OPENAI_MODEL: 'fixture' };
  const original = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  try {
    Object.assign(process.env, values);
    const result = await service.previewAiContext({ params: { shopId: 'shop-flower' }, body: { question: 'ค่าจัดส่งเท่าไร' } });
    assert.equal(result.data.aiConfigured, true);
    assert.doesNotMatch(JSON.stringify(result), /preview-gemini-secret|preview-openai-secret/);
    assert.ok(result.data.sources.every(source => source.chunkId.startsWith('shop-flower')));
    process.env.AI_MODE = 'offline';
    assert.equal((await service.previewAiContext({ params: { shopId: 'shop-flower' }, body: { question: 'ค่าจัดส่งเท่าไร' } })).data.aiConfigured, false);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}));

test('simulator API contract includes automatic handover and its read-only reason', () => fixture(async ({ db }) => {
  const service = createService(db, { worker: { wake() {} }, workerOptions: { generator: failedGateway() } });
  const result = await service.simulateLineMessage({ params: { shopId: 'shop-flower' }, body: {
    user_id: 'contract-handover', text: 'ค่าจัดส่งเท่าไร',
  } });
  assert.equal(result.data.reply_method, 'handover');
  assert.deepEqual(validate(result.data, schemas.LineSimulateResult), []);
  const room = (await service.getConversation({ params: { shopId: 'shop-flower', conversationId: result.data.conversation_id } })).data;
  assert.equal(room.bot_mode, 'human'); assert.equal(room.handover_reason, 'AI_UNAVAILABLE');
  assert.deepEqual(validate(serializeDates(room), schemas.Conversation), []);
}));
