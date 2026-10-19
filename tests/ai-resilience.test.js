import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAiGateway, AiError } from '../src/services/ai/gateway.js';
import { createConfiguredGenerator, readAiConfig } from '../src/services/ai/config.js';
import { createGeminiProvider, createOpenAiProvider } from '../src/services/ai/providers.js';
import { buildAnswerPrompt } from '../src/services/answerPrompt.js';

const context = [{ chunkId: 'shop-a:0', content: 'ค่าจัดส่ง 50 บาท', title: 'การจัดส่ง' }];
const answer = { text: context[0].content, sourceChunkIds: [context[0].chunkId], insufficient: false };
const input = { shopId: 'shop-a', query: 'ค่าจัดส่งเท่าไร', context,
  prompt: buildAnswerPrompt({ shop: { name: 'ร้านเอ' }, query: 'ค่าจัดส่งเท่าไร', context }) };
const provider = (name, generate) => ({ name, model: `${name}-fixture`, generate });
const gateway = (providers, extra = {}) => createAiGateway({ providers, log() {}, ...extra });
function clock() {
  let time = 1000;
  const waits = [];
  return { now: () => time, random: () => 0, sleep: async ms => { waits.push(ms); time += ms; },
    advance: ms => { time += ms; }, waits };
}

test('Gemini success skips OpenAI; invalid grounding switches to OpenAI without retry', async () => {
  let primary = 0, backup = 0;
  const good = gateway([provider('gemini', async () => { primary++; return answer; }),
    provider('openai', async () => { backup++; return answer; })]);
  assert.equal((await good.generate(input)).provider, 'gemini');
  assert.equal(primary, 1); assert.equal(backup, 0);
  const bad = gateway([provider('gemini', async () => { primary++; return { ...answer, text: 'ส่งฟรี' }; }),
    provider('openai', async () => { backup++; return answer; })]);
  assert.equal((await bad.generate(input)).provider, 'openai');
  assert.equal(primary, 2); assert.equal(backup, 1);
});

test('retry uses bounded exponential backoff and counts attempts once per provider request', async () => {
  const time = clock(); let calls = 0;
  const g = gateway([provider('gemini', async () => {
    if (++calls < 3) throw new AiError('AI_HTTP_503', { retryable: true });
    return answer;
  })], time);
  assert.equal((await g.generate(input)).attempts, 3);
  assert.deepEqual(time.waits, [250, 500]);
  const time2 = clock(); calls = 0;
  const fail = gateway([provider('gemini', async () => {
    calls++; throw new AiError('AI_HTTP_429', { retryable: true, retryAfterMs: 500 });
  }), provider('openai', async () => answer)], time2);
  assert.equal((await fail.generate(input)).provider, 'openai');
  assert.equal(calls, 3); assert.deepEqual(time2.waits, [500, 500]);
});

test('oversized Retry-After and HTTP 401 immediately use backup; no loops when both fail', async () => {
  for (const failure of [new AiError('AI_HTTP_429', { retryable: true, retryAfterMs: 60000 }), new AiError('AI_HTTP_401')]) {
    const time = clock(); let calls = 0;
    const g = gateway([provider('gemini', async () => { calls++; throw failure; }), provider('openai', async () => answer)], time);
    assert.equal((await g.generate(input)).provider, 'openai');
    assert.equal(calls, 1); assert.deepEqual(time.waits, []);
  }
  const time = clock(); let calls = 0;
  const broken = name => provider(name, async () => { calls++; throw new TypeError('transport failure with private information'); });
  await assert.rejects(gateway([broken('gemini'), broken('openai')], time).generate(input), { code: 'AI_UNAVAILABLE' });
  assert.equal(calls, 6);
});

test('insufficient evidence is a successful answer; safety refusal does not call backup', async () => {
  let backup = 0;
  const next = provider('openai', async () => { backup++; return answer; });
  assert.equal((await gateway([provider('gemini', async () => ({ text: '', sourceChunkIds: [], insufficient: true })), next])
    .generate(input)).insufficient, true);
  await assert.rejects(gateway([provider('gemini', async () => { throw new AiError('AI_SAFETY_REFUSAL'); }), next])
    .generate(input), { code: 'AI_SAFETY_REFUSAL' });
  assert.equal(backup, 0);
});

test('cross-tenant IDs, empty output, multiple sources and invalid JSON use backup', async () => {
  for (const value of [{ ...answer, sourceChunkIds: ['shop-b:0'] }, { ...answer, text: '' },
    { ...answer, sourceChunkIds: ['shop-a:0', 'shop-a:0'] }, { text: '', insufficient: true },
    { text: answer.text, sourceChunkIds: answer.sourceChunkIds }, { ...answer, extra: 'unexpected' }]) {
    assert.equal((await gateway([provider('gemini', async () => value), provider('openai', async () => answer)])
      .generate(input)).provider, 'openai');
  }
});

test('three failed logical requests open the circuit; only one probe runs and success closes it', async () => {
  const time = clock(); let calls = 0, release, probeStarted;
  let behavior = async () => { throw new AiError('AI_HTTP_503', { retryable: true }); };
  const g = gateway([provider('gemini', async () => { calls++; return behavior(); }), provider('openai', async () => answer)], time);
  for (let i = 0; i < 3; i++) assert.equal((await g.generate(input)).provider, 'openai');
  assert.equal(calls, 9);
  await g.generate(input); assert.equal(calls, 9);
  time.advance(30000);
  const started = new Promise(resolve => { probeStarted = resolve; });
  behavior = () => new Promise(resolve => { release = resolve; probeStarted(); });
  const probing = g.generate(input); await started;
  assert.equal((await g.generate(input)).provider, 'openai'); assert.equal(calls, 10);
  release(answer); assert.equal((await probing).provider, 'gemini');
  behavior = async () => answer;
  assert.equal((await g.generate(input)).provider, 'gemini'); assert.equal(calls, 11);
});

test('failed probe reopens immediately and expired total budget never starts another provider', async () => {
  const time = clock(); let calls = 0;
  const g = gateway([provider('gemini', async () => { calls++; throw new AiError('AI_HTTP_401'); })], time);
  for (let i = 0; i < 3; i++) await assert.rejects(g.generate(input));
  time.advance(30000);
  await assert.rejects(g.generate(input)); await assert.rejects(g.generate(input));
  assert.equal(calls, 4);
  let backup = 0;
  const expired = gateway([provider('gemini', async () => { time.advance(28000); throw new TypeError('network'); }),
    provider('openai', async () => { backup++; return answer; })], time);
  await assert.rejects(expired.generate(input), { code: 'AI_UNAVAILABLE' }); assert.equal(backup, 0);
});

test('late success from a request admitted before opening cannot close a newer circuit', async () => {
  const time = clock(); let calls = 0, release, started;
  const ready = new Promise(resolve => { started = resolve; });
  const g = gateway([provider('gemini', async () => {
    if (++calls === 1) return new Promise(resolve => { release = resolve; started(); });
    throw new AiError('AI_HTTP_401');
  }), provider('openai', async () => answer)], time);
  const oldRequest = g.generate(input); await ready;
  for (let i = 0; i < 3; i++) assert.equal((await g.generate(input)).provider, 'openai');
  release(answer); assert.equal((await oldRequest).provider, 'gemini');
  assert.equal((await g.generate(input)).provider, 'openai'); assert.equal(calls, 4);
});

test('timeout aborts ignored transport; caller deadline includes body read and cancellation skips backup', async () => {
  let receivedSignal;
  const hanging = provider('gemini', ({ signal }) => { receivedSignal = signal; return new Promise(() => {}); });
  const g = gateway([hanging, provider('openai', async () => answer)], { attemptTimeoutMs: 10, maxRetries: 0 });
  assert.equal((await g.generate(input)).provider, 'openai'); assert.equal(receivedSignal.aborted, true);
  let backup = 0;
  const cancelled = gateway([hanging, provider('openai', async () => { backup++; return answer; })]);
  const controller = new AbortController();
  const pending = cancelled.generate({ ...input, signal: controller.signal });
  controller.abort(new Error('worker stopping'));
  await assert.rejects(pending, /worker stopping/); assert.equal(backup, 0);
  const bodyHangs = createGeminiProvider({ key: 'fixture', model: 'fixture', fetchImpl: async () => ({
    ok: true, json: () => new Promise(() => {}),
  }) });
  await assert.rejects(gateway([bodyHangs], { maxRetries: 0 }).generate({ ...input, deadlineAt: Date.now() + 10 }),
    { code: 'AI_UNAVAILABLE' });
});

test('cancellation during backoff stops immediately without consuming another provider', async () => {
  const controller = new AbortController(); let calls = 0;
  const broken = provider('gemini', async () => { calls++; throw new TypeError('network'); });
  const g = gateway([broken, provider('openai', async () => { calls++; return answer; })], {
    sleep: async (_ms, signal) => { controller.abort(new Error('lease lost')); signal.throwIfAborted(); },
  });
  await assert.rejects(g.generate({ ...input, signal: controller.signal }), /lease lost/); assert.equal(calls, 1);
});

test('provider adapters use structured JSON and separate instruction/data without forwarding tenant identifiers', async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, ...options, body: JSON.parse(options.body) });
    const payload = url.includes('googleapis')
      ? { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(answer) }] } }] }
      : { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(answer) }] }] };
    return Response.json(payload);
  };
  const gemini = createGeminiProvider({ key: 'gemini-secret', model: 'gemini-fixture', fetchImpl });
  const openai = createOpenAiProvider({ key: 'openai-secret', model: 'openai-fixture', fetchImpl });
  const signal = new AbortController().signal;
  assert.deepEqual(await gemini.generate({ ...input, signal }), answer);
  assert.deepEqual(await openai.generate({ ...input, signal }), answer);
  assert.equal(requests[0].headers['x-goog-api-key'], 'gemini-secret');
  assert.equal(requests[0].body.systemInstruction.parts[0].text, input.prompt.messages[0].content);
  assert.equal(requests[0].body.generationConfig.responseMimeType, 'application/json');
  assert.equal(requests[1].headers.Authorization, 'Bearer openai-secret');
  assert.equal(requests[1].body.store, false); assert.equal(requests[1].body.text.format.strict, true);
  assert.deepEqual(requests[1].body.input, input.prompt.messages);
  for (const request of requests) {
    assert.equal(request.body.shopId, undefined); assert.equal(request.redirect, 'error');
    assert.ok(!request.url.includes('secret'));
  }
});

test('provider errors redact upstream text and handle retry-after, refusal, incomplete and malformed results', async () => {
  const make = (payload, options) => createOpenAiProvider({ key: 'private', model: 'fixture',
    fetchImpl: async () => new Response(typeof payload === 'string' ? payload : JSON.stringify(payload), options) });
  const request = { ...input, signal: new AbortController().signal };
  await assert.rejects(make('private-upstream', { status: 429, headers: { 'Retry-After': '2' } }).generate(request),
    error => error.code === 'AI_HTTP_429' && error.retryAfterMs === 2000 && !error.message.includes('private'));
  await assert.rejects(make({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] }).generate(request),
    { code: 'AI_SAFETY_REFUSAL' });
  await assert.rejects(make({ status: 'incomplete' }).generate(request), { code: 'AI_INCOMPLETE' });
  await assert.rejects(make('{').generate(request), { code: 'AI_INVALID_JSON' });
  await assert.rejects(make('null').generate(request), { code: 'AI_INVALID_RESPONSE' });
  await assert.rejects(make({ status: 'completed', output: [] }).generate(request), { code: 'AI_INVALID_JSON' });
  const blocked = createGeminiProvider({ key: 'private', model: 'fixture',
    fetchImpl: async () => Response.json({ promptFeedback: { blockReason: 'SAFETY' } }) });
  await assert.rejects(blocked.generate(request), { code: 'AI_SAFETY_REFUSAL' });
  const malformed = createGeminiProvider({ key: 'private', model: 'fixture',
    fetchImpl: async () => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: {} } }] }) });
  await assert.rejects(malformed.generate(request), { code: 'AI_INVALID_RESPONSE' });
  const bodyDisconnect = createOpenAiProvider({ key: 'private', model: 'fixture', fetchImpl: async () => ({
    ok: true, json: async () => { throw new TypeError('network disconnected while reading'); },
  }) });
  await assert.rejects(bodyDisconnect.generate(request), TypeError);
});

test('configured dual generator fails over through real adapter parsing without calling paid APIs', async () => {
  let calls = 0;
  const configured = createConfiguredGenerator(readAiConfig({ AI_MODE: 'dual', GEMINI_API_KEY: 'fake-gemini',
    GEMINI_MODEL: 'gemini-fixture', OPENAI_API_KEY: 'fake-openai', OPENAI_MODEL: 'openai-fixture' }), {
    log() {}, fetchImpl: async url => {
      calls++;
      if (url.includes('googleapis')) return new Response('upstream-private', { status: 401 });
      return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(answer) }] }] });
    },
  });
  assert.equal((await configured.generate(input)).provider, 'openai'); assert.equal(calls, 2);
});

test('configuration preserves offline/http defaults and requires explicit models and both keys for dual', () => {
  assert.equal(readAiConfig({}).mode, 'offline');
  assert.equal(readAiConfig({ RAG_GENERATOR_URL: 'https://example.test' }).mode, 'http');
  assert.equal(readAiConfig({ AI_MODE: 'offline', RAG_GENERATOR_URL: 'https://example.test' }).mode, 'offline');
  assert.throws(() => readAiConfig({ AI_MODE: 'wrong' }), /AI_MODE/);
  assert.throws(() => readAiConfig({ AI_MODE: 'http' }), /RAG_GENERATOR_URL/);
  assert.throws(() => readAiConfig({ AI_MODE: 'dual' }), /GEMINI_API_KEY/);
  assert.throws(() => readAiConfig({ AI_MODE: 'dual', GEMINI_API_KEY: 'x', GEMINI_MODEL: 'y', OPENAI_API_KEY: 'z' }), /OPENAI_MODEL/);
  assert.equal(createConfiguredGenerator(readAiConfig({})), null);
  assert.throws(() => createConfiguredGenerator(readAiConfig({ RAG_GENERATOR_URL: 'http://example.test' })), /HTTPS/);
});

test('BuddyShare-only inferred setup remains usable and explicit dual mode opts into outage handover', async () => {
  const single = readAiConfig({ BUDDYSHARE_API_KEY: 'fixture-buddy' });
  assert.equal(single.mode, 'auto'); assert.equal(single.buddyModel, 'gemini-3.1-flash-lite');
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url: String(url), options });
    return new Response('{}', { status: 401 });
  };
  const inferred = createConfiguredGenerator(single, { fetchImpl, log() {} });
  assert.equal(inferred.failurePolicy, 'extractive');
  await assert.rejects(inferred.generate(input), { code: 'AI_UNAVAILABLE' });
  assert.equal(requests.length, 1); assert.match(requests[0].url, /buddyshare/);
  assert.throws(() => readAiConfig({ AI_MODE: 'dual', BUDDYSHARE_API_KEY: 'fixture-buddy' }), /BUDDYSHARE_MODEL/);
  const dual = createConfiguredGenerator(readAiConfig({ AI_MODE: 'dual', BUDDYSHARE_API_KEY: 'fixture-buddy',
    BUDDYSHARE_MODEL: 'gemini-fixture', OPENAI_API_KEY: 'fixture-openai', OPENAI_MODEL: 'openai-fixture' }), { fetchImpl, log() {} });
  assert.equal(dual.failurePolicy, 'handover');
  await assert.rejects(dual.generate(input), { code: 'AI_UNAVAILABLE' });
  assert.equal(requests.length, 3); assert.match(requests[1].url, /buddyshare/); assert.match(requests[2].url, /api.openai.com/);
});

test('logs contain only operational metadata, never prompt, query, keys or upstream error contents', async () => {
  const events = [];
  const g = gateway([provider('gemini', async () => { throw new TypeError('secret-key upstream text'); }),
    provider('openai', async () => answer)], { ...clock(), log: event => events.push(event) });
  await g.generate({ ...input, jobId: 'job-fixture' });
  const serialized = JSON.stringify(events);
  assert.match(serialized, /AI_NETWORK/); assert.doesNotMatch(serialized, /secret-key|ค่าจัดส่ง|shop-a/);
  assert.ok(events.every(event => event.jobId === 'job-fixture'));
  assert.ok(events.every(event => Object.keys(event).every(key => ['event', 'provider', 'model', 'attempt', 'durationMs', 'code', 'state', 'jobId'].includes(key))));
});
