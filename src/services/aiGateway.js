import { AiProviderError, createBuddyShareGeminiProvider, createGeminiProvider, createOpenAiProvider } from './aiProviders.js';
import { createHttpRagGenerator } from './ragGenerator.js';

export function createAiGateway({ primary, fallback, timeoutMs = 8500, attemptTimeoutMs = 2000,
  retries = 1, backoffMs = 150, failureThreshold = 2, cooldownMs = 30000,
  now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  const providers = [primary, fallback].filter(Boolean);
  if (!providers.length) return null;
  const states = new Map(providers.map(provider => [provider, { failures: 0, openUntil: 0, probing: false }]));

  return {
    async generate(input) {
      const deadline = now() + timeoutMs;
      for (const provider of providers) {
        const state = states.get(provider);
        if (state.probing || state.openUntil > now()) continue;
        state.probing = state.openUntil > 0;
        try {
          for (let attempt = 0; attempt <= retries; attempt++) {
            const remaining = deadline - now();
            if (remaining <= 0) throw new AiProviderError('AI_BUDGET_EXHAUSTED');
            try {
              const result = await provider.generate(input, AbortSignal.timeout(Math.min(attemptTimeoutMs, remaining)));
              state.failures = 0;
              state.openUntil = 0;
              return result;
            } catch (error) {
              // ลองซ้ำเฉพาะ timeout, network, rate limit และ server error
              const retryable = error?.retryable === true || error?.name === 'TimeoutError' ||
                error?.name === 'AbortError' || error instanceof TypeError;
              if (!retryable || attempt === retries) break;
              const delay = Math.min(backoffMs * 2 ** attempt, Math.max(0, deadline - now()));
              if (delay) await sleep(delay);
            }
          }
          state.failures++;
          if (state.failures >= failureThreshold || state.probing) state.openUntil = now() + cooldownMs;
        } finally { state.probing = false; }
      }
      // RAG ชั้นบนจะเลือกข้อความจากหลักฐานหรือคำตอบว่าไม่มีข้อมูล
      throw new AiProviderError('AI_ALL_PROVIDERS_UNAVAILABLE');
    },
  };
}

export function createConfiguredRagGenerator({ env = process.env, fetchImpl = fetch } = {}) {
  const primary = env.BUDDYSHARE_API_KEY
    ? createBuddyShareGeminiProvider({ apiKey: env.BUDDYSHARE_API_KEY,
      model: env.BUDDYSHARE_MODEL || undefined, fetchImpl })
    : createGeminiProvider({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL || undefined, fetchImpl });
  const fallback = createOpenAiProvider({ apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL || undefined, fetchImpl });
  if (primary || fallback) return createAiGateway({ primary, fallback });
  return createHttpRagGenerator({ url: env.RAG_GENERATOR_URL, token: env.RAG_GENERATOR_TOKEN, fetchImpl });
}

let cachedSettings;
let cachedGenerator;
export function getConfiguredRagGenerator() {
  const settings = [process.env.BUDDYSHARE_API_KEY, process.env.BUDDYSHARE_MODEL,
    process.env.GEMINI_API_KEY, process.env.GEMINI_MODEL, process.env.OPENAI_API_KEY,
    process.env.OPENAI_MODEL, process.env.RAG_GENERATOR_URL, process.env.RAG_GENERATOR_TOKEN];
  if (!cachedSettings || settings.some((value, index) => value !== cachedSettings[index])) {
    cachedGenerator = createConfiguredRagGenerator();
    cachedSettings = settings;
  }
  return cachedGenerator;
}
