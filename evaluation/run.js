import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHmac, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import cases from './task11-cases.json' with { type: 'json' };
import { createTestDatabase } from '../integration/postgresql-fixture.js';
import { migratePostgresql } from '../scripts/postgresql/migrations.js';
import { seedDemo, demoPassword } from '../src/lib/seed.js';
import { createApp } from '../src/lib/app.js';
import { createLineWorker } from '../src/services/worker.js';
import { createHttpRagGenerator } from '../src/services/ragGenerator.js';
import { UNKNOWN_ANSWER } from '../src/services/rag.js';
import { formatChatbotReply } from '../src/services/chatbotReply.js';

// ผลนี้มาจาก fixtures เท่านั้น ไม่ใช้บัญชีจริง และห้าม fallback ไปหา AI ที่ตั้งในเครื่อง
process.env.RAG_GENERATOR_URL = '';
process.env.RAG_GENERATOR_TOKEN = '';
const report = { generated_at: new Date().toISOString(), fixture: 'seedDemo + isolated PostgreSQL schema',
  evidence_level: 'real HTTP + PostgreSQL + durable worker; LINE transport/local AI boundary are test doubles',
  cases: [], failover: [], handover: [], costs: { external_ai_requests: 0, external_line_requests: 0,
    external_api_cost_usd: 0, production_monthly_cost: null, billable_tokens: null }, limitations: [
    'Automatic fixture rubric, not a human quality score or production accuracy estimate',
    'Local elapsed times include webhook, queue processing and DB checkpoint; exclude LINE network, device receipt and human thinking',
    'This runner does not test browser rendering; see the separate browser-results.json. No real LINE or paid AI model test',
    'Host electricity/hosting fees and production token/LINE billing were not measured',
  ] };
try { report.source_revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); report.source_has_changes = Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()); } catch { report.source_revision = 'unavailable'; }
let fixture, db, server, provider, base, worker, providerWorker, providerMode = 'valid';
let releaseProvider, providerEntered;
const tokens = {}, deliveries = [], providerRequests = [];
const secret = 'evaluation-only-fixture-secret';
const elapsed = start => Math.round((performance.now() - start) * 100) / 100;
const sendReply = async payload => { deliveries.push({ kind: 'bot', content: payload.messages[0].text }); };
async function call(path, { shopId, method = 'GET', body, raw, headers = {} } = {}) {
  const response = await fetch(base + path, { method, headers: {
    ...(shopId ? { Authorization: `Bearer ${tokens[shopId]}` } : {}),
    ...(body || raw ? { 'Content-Type': 'application/json' } : {}), ...headers,
  }, ...(body || raw ? { body: raw || JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
}
before(async () => {
  fixture = await createTestDatabase(); db = fixture.db;
  await migratePostgresql({ config: fixture.config }); await seedDemo(db);
  report.runtime = { node: process.version, platform: process.platform,
    next: JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).dependencies.next,
    postgresql: (await db.query('SHOW server_version')).rows[0].server_version };
  provider = createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const input = JSON.parse(raw); const mode = providerMode;
    providerRequests.push({ mode, shop_id: input.shopId, query: input.query,
      source_ids: input.context.map(source => source.knowledgeEntryId) });
    if (mode === 'slow') {
      const timer = setTimeout(() => { if (!res.destroyed) res.end('{}'); }, 12000);
      res.on('close', () => clearTimeout(timer)); return;
    }
    if (mode === 'deferred') { providerEntered?.(); await new Promise(resolve => { releaseProvider = resolve; }); }
    if (mode === 'http503') { res.writeHead(503); res.end('{}'); return; }
    if (mode === 'malformed') { res.end('{bad'); return; }
    res.setHeader('Content-Type', 'application/json');
    const source = input.context[0];
    res.end(JSON.stringify(mode === 'insufficient' ? { insufficient: true }
      : { text: mode === 'unsupported' ? 'ส่งฟรีทั่วโลก 99999 บาท' : source.content,
        sourceChunkIds: [mode === 'foreign-source' ? 'shop-coffee-kb-2:0' : source.chunkId] }));
  });
  provider.listen(0, '127.0.0.1'); await once(provider, 'listening');
  worker = createLineWorker(db, { sendReply, logErrors: false });
  providerWorker = createLineWorker(db, { sendReply, logErrors: false,
    generator: createHttpRagGenerator({ url: `http://127.0.0.1:${provider.address().port}/generate` }) });
  server = createApp(db, { worker, logErrors: false, serviceOptions: {
    sendPush: async payload => { deliveries.push({ kind: 'agent', to: payload.to, content: payload.messages[0].text }); },
  } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
  for (const [shopId, email] of [['shop-coffee', 'coffee@example.test'], ['shop-flower', 'flower@example.test']]) {
    tokens[shopId] = (await call('/api/v1/auth/login', { method: 'POST', body: { email, password: demoPassword } })).body.data.access_token;
    assert.equal((await call(`/api/v1/shops/${shopId}/line/config`, { shopId, method: 'PUT', body: {
      channel_secret: secret, channel_access_token: 'evaluation-only-no-real-line-token',
    } })).status, 200);
  }
  assert.equal((await call('/api/v1/shops/shop-coffee/knowledge', { shopId: 'shop-coffee', method: 'POST', body: {
    kind: 'faq', title: 'ส่วนลดลับ', content: 'ส่วนลดลับ 9999 บาท', status: 'draft',
  } })).status, 201);
});
async function enqueue({ shop_id: shopId, query, id }) {
  const eventId = randomUUID();
  const raw = JSON.stringify({ events: [{ type: 'message', webhookEventId: eventId, replyToken: 'evaluation-only',
    source: { type: 'user', userId: `U-evaluation-${id}` }, message: { type: 'text', id: randomUUID(), text: query } }] });
  const path = `/api/v1/shops/${shopId}/line/webhook`;
  const headers = { 'x-line-signature': createHmac('sha256', secret).update(raw).digest('base64') };
  const response = await call(path, { method: 'POST', raw, headers });
  assert.equal(response.status, 200); assert.equal(response.body.data.processed_count, 1);
  return { eventId, path, raw, headers };
}
async function answer(input, consumer = worker) {
  const start = performance.now(); const event = await enqueue(input);
  await consumer.drain();
  const job = (await db.query('SELECT * FROM line_jobs WHERE event_id=$1', [event.eventId])).rows[0];
  assert.equal(job.status, 'completed'); assert.equal(job.delivery_state, 'sent');
  return { job, elapsed_ms: elapsed(start), event };
}
test('gold questions measure correctness, expected-topic relevance, evidence and tenant isolation', async () => {
  for (const input of cases) {
    const { job, elapsed_ms } = await answer(input);
    const shop = (await db.query('SELECT persona FROM shops WHERE id=$1', [input.shop_id])).rows[0];
    const sourceIds = job.reply_sources.map(source => source.knowledge_entry_id);
    const accuracy = input.expect_unknown ? job.reply_text === UNKNOWN_ANSWER
      : input.expected_fragments.every(fragment => job.reply_text.includes(fragment));
    const relevance = input.expect_unknown ? sourceIds.length === 0
      : sourceIds.some(id => input.expected_sources.includes(id));
    const grounded = job.reply_method === 'no_evidence' ? job.reply_text === UNKNOWN_ANSWER && !sourceIds.length
      : job.reply_sources.some(source => job.reply_text === formatChatbotReply({ text: source.content, method: job.reply_method }, shop.persona));
    const tenantSafe = sourceIds.every(id => id.startsWith(input.shop_id));
    report.cases.push({ ...input, actual: job.reply_text, method: job.reply_method, source_ids: sourceIds,
      correctness: accuracy, relevance, grounded, tenant_safe: tenantSafe, elapsed_ms,
      passed: accuracy && relevance && grounded && tenantSafe });
  }
  assert.deepEqual(report.cases.filter(row => !row.passed).map(row => ({ id: row.id, actual: row.actual })), []);
});
test('HTTP AI failover keeps evidence boundaries under failure, unsafe output and timeout', async () => {
  for (const mode of ['valid', 'http503', 'malformed', 'unsupported', 'foreign-source', 'insufficient', 'slow']) {
    providerMode = mode;
    const { job, elapsed_ms } = await answer({ id: `failover-${mode}`, shop_id: 'shop-flower', query: 'ค่าจัดส่งเท่าไร' }, providerWorker);
    const expectedMethod = mode === 'valid' ? 'generator' : mode === 'insufficient' ? 'no_evidence' : 'extractive';
    const passed = job.reply_method === expectedMethod && (mode === 'insufficient'
      ? job.reply_text === UNKNOWN_ANSWER : job.reply_text.includes('50 บาท') && !job.reply_text.includes('99999'))
      && elapsed_ms < 12000;
    report.failover.push({ mode, expected_method: expectedMethod, actual_method: job.reply_method, actual: job.reply_text, elapsed_ms, passed });
  }
  assert.ok(report.failover.every(row => row.passed), JSON.stringify(report.failover));
  assert.ok(providerRequests.every(row => row.source_ids.every(id => id.startsWith(row.shop_id))));
});
test('signed webhook to handover, agent push, resume, duplicate and pending AI cancellation', async () => {
  const input = { id: 'handover-flow', shop_id: 'shop-flower', query: 'ร้านเปิดกี่โมง' };
  const initial = await answer(input); const path = `/api/v1/shops/shop-flower/conversations/${initial.job.conversation_id}`;
  const mutate = body => call(path, { shopId: input.shop_id, method: 'PATCH', body });
  let start = performance.now();
  assert.equal((await mutate({ bot_mode: 'human' })).body.data.bot_mode, 'human');
  report.handover.push({ step: 'takeover', elapsed_ms: elapsed(start), passed: true });
  const beforePaused = deliveries.length;
  await enqueue(input); await worker.drain();
  assert.equal(deliveries.length, beforePaused);
  report.handover.push({ step: 'no_bot_while_human', passed: true });
  start = performance.now();
  const body = { request_id: randomUUID(), content: 'เจ้าหน้าที่รับเรื่องแล้ว' };
  const sent = await call(path + '/replies', { shopId: input.shop_id, method: 'POST', body });
  assert.equal(sent.body.data.status, 'sent'); assert.equal(deliveries.at(-1).to, `U-evaluation-${input.id}`);
  const count = deliveries.length;
  assert.equal((await call(path + '/replies', { shopId: input.shop_id, method: 'POST', body })).body.data.id, sent.body.data.id);
  assert.equal(deliveries.length, count);
  report.handover.push({ step: 'agent_push_and_idempotency', elapsed_ms: elapsed(start), passed: true });
  assert.equal((await mutate({ bot_mode: 'paused' })).status, 200);
  await enqueue(input); await worker.drain(); assert.equal(deliveries.length, count);
  assert.equal((await mutate({ bot_mode: 'active' })).status, 200);
  start = performance.now(); await answer(input);
  report.handover.push({ step: 'resume_fresh_event', elapsed_ms: elapsed(start), passed: true });
  const beforeDuplicate = deliveries.length;
  assert.equal((await call(initial.event.path, { method: 'POST', raw: initial.event.raw, headers: initial.event.headers })).body.data.processed_count, 0);
  await worker.drain(); assert.equal(deliveries.length, beforeDuplicate);
  report.handover.push({ step: 'duplicate_webhook_no_resend', passed: true });
  providerMode = 'deferred';
  const entered = new Promise(resolve => { providerEntered = resolve; });
  await enqueue({ ...input, query: 'ค่าจัดส่งเท่าไร' });
  const pending = providerWorker.runOnce();
  try {
    await entered;
    assert.equal((await mutate({ bot_mode: 'paused' })).status, 200);
    assert.equal((await mutate({ bot_mode: 'active' })).status, 200);
    releaseProvider(); await pending; assert.equal(deliveries.length, beforeDuplicate);
    report.handover.push({ step: 'pause_resume_cancels_pending_ai', passed: true });
  } finally { releaseProvider?.(); await pending; }
  assert.equal((await call(path + '/replies', { shopId: 'shop-coffee' })).status, 404);
  assert.equal((await call(path + '/replies')).status, 401);
  report.handover.push({ step: 'tenant_and_session_guards', passed: true });
});
after(async () => {
  await worker?.stop(); await providerWorker?.stop();
  if (server) { await new Promise(resolve => server.close(resolve)); await server.drain(); }
  if (provider) { provider.closeAllConnections(); await new Promise(resolve => provider.close(resolve)); }
  await fixture?.dispose();
  const summarize = rows => ({ total: rows.length, passed: rows.filter(row => row.passed).length, failed: rows.filter(row => !row.passed).length });
  const times = report.cases.map(row => row.elapsed_ms).sort((a, b) => a - b);
  const percentile = p => times.length ? times[Math.ceil(times.length * p) - 1] : null;
  report.summary = { quality: summarize(report.cases), failover: summarize(report.failover), handover: summarize(report.handover),
    correctness_pass: report.cases.filter(row => row.correctness).length, relevance_pass: report.cases.filter(row => row.relevance).length,
    grounded_pass: report.cases.filter(row => row.grounded).length, tenant_safe_pass: report.cases.filter(row => row.tenant_safe).length,
    local_latency_ms: { p50: percentile(0.5), p95: percentile(0.95), max: times.at(-1) ?? null } };
  report.costs.local_ai_boundary_requests = providerRequests.length;
  report.provider_requests = providerRequests;
  const directory = resolve(process.env.EVALUATION_REPORT_DIR || 'reports/task11');
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  // เว้นคะแนนมนุษย์ว่างไว้ ไม่ใช้คะแนนอัตโนมัติปลอมเป็นผลประเมินของผู้ทดสอบ
  const csv = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const reviewRows = [['id', 'shop_id', 'question', 'expected', 'actual', 'human_accuracy_0_2', 'human_relevance_0_2', 'human_unsupported_yes_no', 'reviewer', 'notes'],
    ...report.cases.map(row => [row.id, row.shop_id, row.query, row.expect_unknown ? UNKNOWN_ANSWER : row.expected_fragments.join(' / '), row.actual, '', '', '', '', ''])];
  await writeFile(resolve(directory, 'human-review.csv'), '\uFEFF' + reviewRows.map(row => row.map(csv).join(',')).join('\r\n') + '\r\n');
  const md = [`# ผลวัดข้อ 11 — fixtures ในเครื่อง`, '', `เวลา: ${report.generated_at}`, '',
    '**ไม่ใช่ผลจากลูกค้า LINE จริง โมเดล AI จริง หรือคะแนนประเมินโดยมนุษย์**', '',
    '| กลุ่ม | ผ่าน | ทั้งหมด |', '|---|---:|---:|',
    ...Object.entries(report.summary).filter(([, value]) => typeof value === 'object' && 'total' in value).map(([key, value]) => `| ${key} | ${value.passed} | ${value.total} |`), '',
    `เวลา webhook → worker → DB (local): p50 ${percentile(0.5)} ms, p95 ${percentile(0.95)} ms; ไม่รวม LINE network/เวลาคิดของแอดมิน`, '',
    'ค่าเรียก LINE/AI ภายนอกในรอบนี้: 0 USD เพราะใช้ test transport และ local HTTP provider; ค่าใช้งานจริงต่อเดือน/จำนวน tokens ยังไม่วัด', '',
    '## คำถามและเฉลย', '', '| ID | ผล | เวลา ms | คำตอบจริง (fixture) |', '|---|---|---:|---|',
    ...report.cases.map(row => `| ${row.id} | ${row.passed ? 'ผ่าน' : 'ไม่ผ่าน'} | ${row.elapsed_ms} | ${row.actual.replaceAll('|', '\\|').replaceAll('\n', ' ')} |`), '',
    '## Failover', '', ...report.failover.map(row => `- ${row.mode}: ${row.passed ? 'ผ่าน' : 'ไม่ผ่าน'} / ${row.actual_method} / ${row.elapsed_ms} ms`), '',
    '## Handover', '', ...report.handover.map(row => `- ${row.step}: ${row.passed ? 'ผ่าน' : 'ไม่ผ่าน'}${row.elapsed_ms === undefined ? '' : ` / ${row.elapsed_ms} ms`}`), '',
    '## ข้อจำกัด', '', ...report.limitations.map(item => `- ${item}`), '',
    'เกณฑ์อัตโนมัติ: correctness ตรวจ facts จากเฉลย, relevance ตรวจ source ID ตามหัวข้อที่คาดไว้, grounded ตรวจข้อความเป็น excerpt ของหลักฐานบวก persona template และ no_evidence ตรงข้อความปฏิเสธ ไม่ใช่การให้คะแนนเชิงความหมายโดยคน', '',
    'ดู expected/actual และผลรายมิติใน [results.json](results.json)', ''];
  await writeFile(resolve(directory, 'report.md'), md.join('\n'));
  console.log('TASK11_EVALUATION', JSON.stringify(report.summary));
});
