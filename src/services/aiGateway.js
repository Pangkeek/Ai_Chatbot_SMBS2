// Compatibility entrypoints for master's scripts/tests. All execution uses the shared gateway.
import { createAiGateway as createGateway } from './ai/gateway.js';
import { createConfiguredGenerator, getRuntimeGenerator, readAiConfig } from './ai/config.js';

const legacyResult = result => result.insufficient ? { insufficient: true }
  : { text: result.text, sourceChunkIds: result.sourceChunkIds };
function legacyFacade(generator) {
  if (!generator) return null;
  return { failurePolicy: generator.failurePolicy,
    async generate(input) { return legacyResult(await generator.generate(input)); } };
}

export function createAiGateway({ primary, fallback, timeoutMs = 8500, attemptTimeoutMs = 2000,
  retries = 1, backoffMs = 150, failureThreshold = 2, cooldownMs = 30000, ...options }) {
  const providers = [primary, fallback].filter(Boolean).map((provider, index) => ({
    name: provider.name || (index ? 'openai' : 'gemini'), model: provider.model,
    async generate(input) {
      const result = await provider.generate(input, input.signal);
      return { text: result.insufficient ? '' : result.text,
        sourceChunkIds: result.insufficient ? [] : result.sourceChunkIds, insufficient: result.insufficient === true };
    },
  }));
  if (!providers.length) return null;
  return legacyFacade(createGateway({ ...options, providers, totalBudgetMs: timeoutMs,
    attemptTimeoutMs, maxRetries: retries, backoffMs, breakerThreshold: failureThreshold, breakerCooldownMs: cooldownMs }));
}

export function createConfiguredRagGenerator({ env = process.env, ...options } = {}) {
  return legacyFacade(createConfiguredGenerator(readAiConfig(env), options));
}

export function getConfiguredRagGenerator() { return legacyFacade(getRuntimeGenerator()); }
