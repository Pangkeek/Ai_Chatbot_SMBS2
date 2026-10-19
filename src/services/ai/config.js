import { createAiGateway } from './gateway.js';
import { createBuddyShareGeminiProvider, createGeminiProvider, createOpenAiProvider } from './providers.js';
import { createHttpRagGenerator } from '../ragGenerator.js';

export function readAiConfig(env = process.env) {
  if (env.AI_MODE && !['offline', 'http', 'dual'].includes(env.AI_MODE)) throw new Error('AI_MODE must be offline, http or dual');
  // Preserve master's key-based setup, including BuddyShare-only local demos.
  const mode = env.AI_MODE || (env.BUDDYSHARE_API_KEY || env.GEMINI_API_KEY || env.OPENAI_API_KEY
    ? 'auto' : env.RAG_GENERATOR_URL ? 'http' : 'offline');
  if (mode === 'http' && !env.RAG_GENERATOR_URL) throw new Error('RAG_GENERATOR_URL is required in http mode');
  const primaryNames = env.BUDDYSHARE_API_KEY ? ['BUDDYSHARE_API_KEY', 'BUDDYSHARE_MODEL'] : ['GEMINI_API_KEY', 'GEMINI_MODEL'];
  if (mode === 'dual') for (const name of [...primaryNames, 'OPENAI_API_KEY', 'OPENAI_MODEL']) {
    if (!env[name]?.trim()) throw new Error(`${name} is required in dual mode`);
  }
  return { mode, url: env.RAG_GENERATOR_URL, token: env.RAG_GENERATOR_TOKEN,
    geminiKey: env.GEMINI_API_KEY, geminiModel: env.GEMINI_MODEL || 'gemini-3.6-flash',
    buddyKey: env.BUDDYSHARE_API_KEY, buddyModel: env.BUDDYSHARE_MODEL || 'gemini-3.1-flash-lite',
    openaiKey: env.OPENAI_API_KEY, openaiModel: env.OPENAI_MODEL || 'gpt-5.6-luna' };
}

export function createConfiguredGenerator(config, options = {}) {
  if (config.mode === 'offline') return null;
  if (config.mode === 'http') return createHttpRagGenerator({ url: config.url, token: config.token, fetchImpl: options.fetchImpl });
  const primary = config.buddyKey
    ? createBuddyShareGeminiProvider({ key: config.buddyKey, model: config.buddyModel, fetchImpl: options.fetchImpl })
    : config.geminiKey ? createGeminiProvider({ key: config.geminiKey, model: config.geminiModel, fetchImpl: options.fetchImpl }) : null;
  const fallback = config.openaiKey ? createOpenAiProvider({ key: config.openaiKey, model: config.openaiModel, fetchImpl: options.fetchImpl }) : null;
  const gateway = createAiGateway({ ...(config.buddyKey ? { attemptTimeoutMs: 9500, maxRetries: fallback ? 0 : 1 } : {}),
    ...options, providers: [primary, fallback].filter(Boolean) });
  // Explicit dual mode opts into outage handover; inferred setup retains master's extractive fallback.
  if (config.mode === 'auto') gateway.failurePolicy = 'extractive';
  return gateway;
}

const runtimeKey = Symbol.for('smb.ai.runtime.v1');
export function getRuntimeGenerator() {
  // Share circuits across callers/reloads. Only actual server configuration changes reset them.
  const state = globalThis[runtimeKey] ??= {};
  const config = readAiConfig();
  const settings = JSON.stringify(config);
  if (settings !== state.settings) { state.generator = createConfiguredGenerator(config); state.settings = settings; }
  return state.generator;
}

export function withConfiguredGenerator(options = {}) {
  if (Object.hasOwn(options, 'generator') || options.generateReply) return options;
  return { ...options, generator: getRuntimeGenerator() };
}
