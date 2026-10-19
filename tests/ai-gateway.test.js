import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAiGateway, createConfiguredRagGenerator } from '../src/services/aiGateway.js';
import { AiProviderError } from '../src/services/aiProviders.js';

const source = { chunkId: 'shop-flower-kb-3:0', content: 'จัดส่งภายในเมือง ค่าจัดส่ง 50 บาท' };
const input = { shopId: 'shop-flower', query: 'ค่าจัดส่งเท่าไร', context: [source], prompt: { messages: [
  { role: 'system', content: 'ใช้หลักฐานของร้านเท่านั้น' },
  { role: 'user', content: JSON.stringify({ shopName: 'บ้านดอกไม้', evidence: [source] }) },
] } };
const answer = { text: source.content, sourceChunkIds: [source.chunkId], insufficient: false };
const geminiResponse = value => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] }), { status: 200 });
const openAiResponse = value => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [
  { type: 'output_text', text: JSON.stringify(value) },
] }] }), { status: 200 });

test('Gemini receives only selected shop evidence and returns a checked excerpt', async () => {
  const requests = [];
  const generator = createConfiguredRagGenerator({ env: { GEMINI_API_KEY: 'gemini-test', OPENAI_API_KEY: 'openai-test' },
    fetchImpl: async (url, options) => { requests.push({ url: String(url), options }); return geminiResponse(answer); } });
  assert.deepEqual(await generator.generate(input), { text: source.content, sourceChunkIds: [source.chunkId] });
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /generativelanguage\.googleapis\.com/);
  assert.equal(requests[0].options.headers['x-goog-api-key'], 'gemini-test');
  const body = JSON.parse(requests[0].options.body);
  assert.equal(body.contents[0].parts[0].text, input.prompt.messages[1].content);
  assert.equal(body.generationConfig.responseFormat.text.mimeType, 'APPLICATION_JSON');
});

test('Gemini HTTP failures retry and OpenAI answers as backup', async () => {
  const requests = [];
  const generator = createConfiguredRagGenerator({ env: { GEMINI_API_KEY: 'gemini-test', OPENAI_API_KEY: 'openai-test' },
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      return String(url).includes('googleapis') ? new Response('{}', { status: 503 }) : openAiResponse(answer);
    } });
  assert.deepEqual(await generator.generate(input), { text: source.content, sourceChunkIds: [source.chunkId] });
  assert.equal(requests.length, 3);
  assert.equal(requests[2].options.headers.Authorization, 'Bearer openai-test');
  const body = JSON.parse(requests[2].options.body);
  assert.equal(body.store, false);
  assert.equal(body.input[1].content, input.prompt.messages[1].content);
  assert.equal(body.text.format.type, 'json_schema');
});

test('unsupported or foreign evidence from primary uses backup without a retry', async () => {
  let primaryCalls = 0, backupCalls = 0;
  const generator = createConfiguredRagGenerator({ env: { GEMINI_API_KEY: 'gemini-test', OPENAI_API_KEY: 'openai-test' },
    fetchImpl: async url => {
      if (String(url).includes('googleapis')) { primaryCalls++; return geminiResponse({ ...answer, sourceChunkIds: ['other-shop:0'] }); }
      backupCalls++; return openAiResponse(answer);
    } });
  assert.equal((await generator.generate(input)).text, source.content);
  assert.equal(primaryCalls, 1);
  assert.equal(backupCalls, 1);
});

test('both providers failing produces a bounded error for the extractive RAG fallback', async () => {
  const generator = createConfiguredRagGenerator({ env: { GEMINI_API_KEY: 'gemini-test', OPENAI_API_KEY: 'openai-test' },
    fetchImpl: async () => new Response('{}', { status: 503 }) });
  await assert.rejects(generator.generate(input), { code: 'AI_ALL_PROVIDERS_UNAVAILABLE' });
});

test('timeout changes to backup and circuit breaker skips repeated primary failures', async () => {
  let currentTime = 1000, primaryCalls = 0, backupCalls = 0;
  const primary = { async generate(_input, signal) {
    primaryCalls++;
    if (primaryCalls === 1) await new Promise((_, reject) => signal.addEventListener('abort', () => reject(new AiProviderError('AI_TIMEOUT', true)), { once: true }));
    if (primaryCalls < 3) throw new AiProviderError('AI_HTTP_503', true);
    return answer;
  } };
  const fallback = { async generate() { backupCalls++; return answer; } };
  const gateway = createAiGateway({ primary, fallback, attemptTimeoutMs: 20, retries: 0,
    failureThreshold: 2, cooldownMs: 100, now: () => currentTime });
  await gateway.generate(input);
  await gateway.generate(input);
  await gateway.generate(input);
  assert.equal(primaryCalls, 2);
  assert.equal(backupCalls, 3);
  currentTime += 101;
  await gateway.generate(input);
  assert.equal(primaryCalls, 3);
  assert.equal(backupCalls, 3);
});

test('without direct keys, the previous HTTP generator remains available', async () => {
  assert.equal(createConfiguredRagGenerator({ env: {} }), null);
  let called = false;
  const generator = createConfiguredRagGenerator({ env: { RAG_GENERATOR_URL: 'https://ai.example.test/generate' },
    fetchImpl: async () => { called = true; return new Response(JSON.stringify(answer), { status: 200 }); } });
  await generator.generate(input);
  assert.equal(called, true);
});
