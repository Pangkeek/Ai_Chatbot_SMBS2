import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withTestSchema } from '../integration/postgresql-fixture.js';
import { migratePostgresql } from '../scripts/postgresql/migrations.js';
import { seedDemo } from '../src/lib/seed.js';
import { createService } from '../src/services/service.js';
import { createLineWorker } from '../src/services/worker.js';
import { answerQuestion, embed, rebuildKnowledgeIndex, retrieve, UNKNOWN_ANSWER } from '../src/services/rag.js';
import { createHttpRagGenerator } from '../src/services/ragGenerator.js';
import { createConfiguredRagGenerator } from '../src/services/aiGateway.js';

async function withDemo(run) {
  return withTestSchema(async ({db,config}) => {
    await migratePostgresql({config});
    await seedDemo(db);
    return run(db);
  });
}

test('FAQ matches Thai questions regardless of spaces between words', async () => {
  const title = 'ร้าน ค้า มี ไว ไฟ ไหม';
  const content = 'ร้านค้ามีไวไฟฟรีสำหรับลูกค้า';
  const faq = { chunk_id: 'wifi:0', knowledge_entry_id: 'wifi', kind: 'faq', title,
    content, full_content: content, embedding_json: JSON.stringify(embed(`${title} ${content}`)) };
  const shop = { id: 'shop-coffee', name: 'บ้านกาแฟ' };
  const db = { async query(sql) {
    return { rows: sql.includes('FROM knowledge_chunks') ? [faq] : [shop] };
  } };
  for (const query of ['ร้าน ค้า มี ไว ไฟ ไหม', 'ร้านค้ามีไวไฟไหม']) {
    const answer = await answerQuestion(db, { shopId: shop.id, query,
      generator: { async generate() { return { insufficient: true }; } } });
    assert.equal(answer.method, 'faq');
    assert.equal(answer.text, content);
    assert.deepEqual(answer.sources.map(source => source.knowledge_entry_id), ['wifi']);
  }
});

test('published chunks and embeddings are scoped to the shop; FAQ and unknown answers are grounded', () => withDemo(async db => {
  assert.equal((await db.query('SELECT count(*)::int AS n FROM knowledge_chunks', [])).rows[0].n, 6);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM knowledge_chunks WHERE shop_id = 'shop-coffee'", [])).rows[0].n, 3);
  const coffee = await answerQuestion(db, { shopId: 'shop-coffee', query: 'ร้านเปิดกี่โมงครับ' });
  assert.equal(coffee.method, 'faq');
  assert.deepEqual(coffee.sources.map(source => source.knowledge_entry_id), ['shop-coffee-kb-1']);
  assert.match(coffee.text, /08:00-18:00/);
  assert.doesNotMatch(coffee.text, /09:00-19:00/);
  const flower = await answerQuestion(db, { shopId: 'shop-flower', query: 'ส่งดอกไม้ได้ไหม' });
  assert.equal(flower.sources[0].knowledge_entry_id, 'shop-flower-kb-3');
  assert.match(flower.text, /จัดส่งภายในเมือง/);
  assert.ok((await retrieve(db, { shopId: 'shop-coffee', query: 'ส่งดอกไม้ได้ไหม' }))
    .every(row => row.knowledge_entry_id.startsWith('shop-coffee')));
  const unknown = await answerQuestion(db, { shopId: 'shop-coffee', query: 'มีที่จอดรถไหม' });
  assert.equal(unknown.text, UNKNOWN_ANSWER);
  assert.deepEqual(unknown.sources, []);
}));

test('Thai Sara Am normalization must not turn สำหรับ into an unrelated รับ payment match', () => withDemo(async db => {
  const query = 'รับโอนธนาคารอะไร';
  const missing = await answerQuestion(db, { shopId: 'shop-coffee', query });
  assert.equal(missing.text, UNKNOWN_ANSWER);
  assert.deepEqual(missing.sources, []);
  const service = createService(db);
  const policy = (await service.createKnowledge({ params: { shopId: 'shop-coffee' }, user: { id: 'user-coffee' }, body: {
    kind: 'policy', title: 'การชำระเงิน', content: 'รับโอนผ่านธนาคารกสิกรไทย', status: 'published',
  } })).data;
  const known = await answerQuestion(db, { shopId: 'shop-coffee', query });
  assert.match(known.text, /ธนาคารกสิกรไทย/);
  assert.equal(known.sources[0].knowledge_entry_id, policy.id);
}));

test('create, edit, publish, draft and delete update the index; rebuild covers existing data', () => withDemo(async db => {
  const service = createService(db);
  const params = { shopId: 'shop-coffee' };
  const user = { id: 'user-coffee' };
  const created = (await service.createKnowledge({ params, user, body: {
    kind: 'faq', title: 'มีไวไฟไหม', content: 'มีไวไฟฟรีสำหรับลูกค้า', status: 'draft',
  } })).data;
  assert.equal((await db.query('SELECT count(*)::int AS n FROM knowledge_chunks WHERE knowledge_entry_id = $1', [created.id])).rows[0].n, 0);
  await service.updateKnowledge({ params: { ...params, knowledgeId: created.id }, body: { status: 'published' } });
  assert.equal((await retrieve(db, { shopId: params.shopId, query: 'มีไวไฟไหม' }))[0].knowledge_entry_id, created.id);
  await service.updateKnowledge({ params: { ...params, knowledgeId: created.id }, body: { content: 'มีไวไฟความเร็วสูงฟรี' } });
  assert.match((await retrieve(db, { shopId: params.shopId, query: 'มีไวไฟไหม' }))[0].content, /ความเร็วสูง/);
  assert.doesNotMatch((await retrieve(db, { shopId: params.shopId, query: 'มีไวไฟไหม' }))[0].content, /สำหรับลูกค้า/);
  await service.updateKnowledge({ params: { ...params, knowledgeId: created.id }, body: { status: 'draft' } });
  assert.equal((await db.query('SELECT count(*)::int AS n FROM knowledge_chunks WHERE knowledge_entry_id = $1', [created.id])).rows[0].n, 0);
  await service.updateKnowledge({ params: { ...params, knowledgeId: created.id }, body: { status: 'published' } });
  await service.deleteKnowledge({ params: { ...params, knowledgeId: created.id } });
  assert.equal((await db.query('SELECT count(*)::int AS n FROM knowledge_chunks WHERE knowledge_entry_id = $1', [created.id])).rows[0].n, 0);
  (await db.query('DELETE FROM knowledge_chunks', []));
  assert.deepEqual(await rebuildKnowledgeIndex(db), { entries: 6, chunks: 6 });
  assert.ok((await retrieve(db, { shopId: 'shop-coffee', query: 'ร้านเปิดกี่โมงครับ' })).length);
}));

test('generator receives only tenant context and unsupported output is rejected', () => withDemo(async db => {
  await createService(db).createKnowledge({ params: { shopId: 'shop-flower' }, user: { id: 'user-flower' }, body: {
    kind: 'policy', title: 'ค่าจัดส่งลับ', content: 'ส่งฟรีทั่วโลกสำหรับลูกค้าทุกคน', status: 'draft',
  } });
  let supplied;
  const result = await answerQuestion(db, { shopId: 'shop-flower', query: 'ค่าจัดส่งเท่าไร', generator: {
    async generate(input) {
      supplied = input;
      return { text: 'จัดส่งฟรีทั่วประเทศ', sourceChunkIds: [input.context[0].chunkId] };
    },
  } });
  assert.equal(supplied.shopId, 'shop-flower');
  assert.ok(supplied.context.length);
  assert.ok(supplied.context.every(row => row.knowledgeEntryId.startsWith('shop-flower')));
  assert.ok(supplied.context.every(row => !row.content.includes('ครัวซองต์')));
  assert.ok(supplied.context.every(row => !row.content.includes('ส่งฟรีทั่วโลก')));
  assert.equal(result.method, 'extractive');
  assert.doesNotMatch(result.text, /ฟรีทั่วประเทศ/);
  const accepted = await answerQuestion(db, { shopId: 'shop-flower', query: 'ค่าจัดส่งเท่าไร', generator: {
    async generate({ context }) {
      return { text: context[0].content, sourceChunkIds: [context[0].chunkId] };
    },
  } });
  assert.equal(accepted.method, 'generator');
}));

test('HTTP AI boundary sends scoped context and accepts only a quoted supported answer', () => withDemo(async db => {
  let request;
  const generator = createHttpRagGenerator({ url: 'https://ai.example.test/generate', token: 'test-token',
    fetchImpl: async (url, options) => {
      request = { url: String(url), headers: options.headers, body: JSON.parse(options.body) };
      const source = request.body.context[0];
      return new Response(JSON.stringify({ text: source.content, sourceChunkIds: [source.chunkId] }), { status: 200 });
    },
  });
  const answer = await answerQuestion(db, { shopId: 'shop-flower', query: 'ค่าจัดส่งเท่าไร', generator });
  assert.equal(answer.method, 'generator');
  assert.equal(request.url, 'https://ai.example.test/generate');
  assert.equal(request.headers.Authorization, 'Bearer test-token');
  assert.ok(request.body.context.every(row => row.knowledgeEntryId.startsWith('shop-flower')));
  assert.deepEqual(answer.sources.map(source => source.knowledge_entry_id), ['shop-flower-kb-3']);
  assert.throws(() => createHttpRagGenerator({ url: 'http://ai.example.test/generate' }), /HTTPS/);
}));

test('RAG uses OpenAI after Gemini fails and keeps the verified source', () => withDemo(async db => {
  const requests = [];
  const generator = createConfiguredRagGenerator({ env: { GEMINI_API_KEY: 'test-gemini', OPENAI_API_KEY: 'test-openai' },
    fetchImpl: async (url, options) => {
      requests.push(String(url));
      if (String(url).includes('googleapis')) return new Response('{}', { status: 503 });
      const evidence = JSON.parse(JSON.parse(options.body).input[1].content).evidence[0];
      return new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text',
        text: JSON.stringify({ text: evidence.content, sourceChunkIds: [evidence.chunkId], insufficient: false }),
      }] }] }), { status: 200 });
    } });
  const result = await answerQuestion(db, { shopId: 'shop-flower', query: 'ค่าจัดส่งเท่าไร', generator });
  assert.equal(result.method, 'generator');
  assert.equal(result.sources[0].knowledge_entry_id, 'shop-flower-kb-3');
  assert.equal(requests.length, 4);
}));

test('RAG falls back to local evidence when both AI providers fail', () => withDemo(async db => {
  const generator = createConfiguredRagGenerator({ env: { GEMINI_API_KEY: 'test-gemini', OPENAI_API_KEY: 'test-openai' },
    fetchImpl: async () => new Response('{}', { status: 503 }) });
  const result = await answerQuestion(db, { shopId: 'shop-flower', query: 'ค่าจัดส่งเท่าไร', generator });
  assert.equal(result.method, 'extractive');
  assert.match(result.text, /ค่าจัดส่ง 50 บาท/);
  assert.equal(result.sources[0].knowledge_entry_id, 'shop-flower-kb-3');
}));

test('LINE simulator records a backup AI answer with the right shop source', () => withDemo(async db => {
  const generator = createConfiguredRagGenerator({ env: { GEMINI_API_KEY: 'test-gemini', OPENAI_API_KEY: 'test-openai' },
    fetchImpl: async (url, options) => {
      if (String(url).includes('googleapis')) return new Response('{}', { status: 503 });
      const evidence = JSON.parse(JSON.parse(options.body).input[1].content).evidence[0];
      return new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text',
        text: JSON.stringify({ text: evidence.content, sourceChunkIds: [evidence.chunkId], insufficient: false }),
      }] }] }), { status: 200 });
    } });
  const worker = createLineWorker(db, { generator, logErrors: false });
  const result = await worker.handleMessageEvent({ shopId: 'shop-flower', simulated: true,
    event: { source: { userId: 'backup-ai-test' }, message: { text: 'ค่าจัดส่งเท่าไร' } } });
  assert.equal(result.replied, true);
  assert.equal(result.replyMethod, 'generator');
  assert.deepEqual(result.sourceKnowledgeIds, ['shop-flower-kb-3']);
  const saved = (await db.query('SELECT source_excerpt FROM message_sources WHERE shop_id=$1 AND message_id=$2',
    ['shop-flower', result.replyMsgId])).rows[0];
  assert.match(saved.source_excerpt, /ค่าจัดส่ง 50 บาท/);
}));

test('worker saves source IDs after delivery, retains audit after deletion, and rechecks bot_mode', () => withDemo(async db => {
  await db.query("INSERT INTO line_channels(shop_id,channel_secret,channel_access_token,created_at,updated_at) SELECT id,'test-secret','test-token',now(),now() FROM shops");
  const sent = [];
  const worker = createLineWorker(db, { sendReply: async args => { sent.push(args); }, logErrors: false });
  const event = (userId, text) => ({ source: { userId }, message: { type: 'text', text }, replyToken: `token-${userId}` });
  const reply = await worker.handleMessageEvent({ shopId: 'shop-coffee', event: event('audit', 'ร้านเปิดกี่โมงครับ'),
    channelConfig: { channel_access_token: 'token' } });
  assert.equal(reply.replied, true);
  assert.deepEqual(reply.sourceKnowledgeIds, ['shop-coffee-kb-1']);
  assert.equal(sent.length, 1);
  const source = (await db.query('SELECT * FROM message_sources WHERE shop_id = $1 AND message_id = $2', ['shop-coffee', reply.replyMsgId])).rows[0];
  assert.equal(source.knowledge_entry_id, 'shop-coffee-kb-1');
  const service = createService(db);
  await service.deleteKnowledge({ params: { shopId: 'shop-coffee', knowledgeId: 'shop-coffee-kb-1' } });
  assert.equal((await db.query('SELECT knowledge_entry_id FROM message_sources WHERE message_id = $1', [reply.replyMsgId])).rows[0].knowledge_entry_id,
    'shop-coffee-kb-1');

  let release, generationStarted;
  const started = new Promise(resolve => { generationStarted = resolve; });
  const blocked = createLineWorker(db, { sendReply: async args => { sent.push(args); }, generator: {
    generate: () => new Promise(resolve => { release = resolve; generationStarted(); }),
  }, logErrors: false });
  const pending = blocked.handleMessageEvent({ shopId: 'shop-flower', event: event('pause', 'ค่าจัดส่งเท่าไร'),
    channelConfig: { channel_access_token: 'token' } });
  await started;
  (await db.query("UPDATE conversations SET bot_mode = 'human' WHERE shop_id = 'shop-flower' AND customer_external_id = 'pause'", []));
  release({ text: 'จัดส่งภายในเมือง ค่าจัดส่ง 50 บาท กรุณาสั่งล่วงหน้า 1 วัน',
    sourceChunkIds: ['shop-flower-kb-3:0'] });
  const paused = await pending;
  assert.equal(paused.replied, false);
  assert.equal(sent.length, 1);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM messages WHERE shop_id = $1 AND role = $2 AND conversation_id = $3', ['shop-flower', 'assistant', paused.conversationId])).rows[0].n, 0);
}));
