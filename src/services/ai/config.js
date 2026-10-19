import { createAiGateway } from './gateway.js';
import { createGeminiProvider, createOpenAiProvider } from './providers.js';
import { createHttpRagGenerator } from '../ragGenerator.js';

export function readAiConfig(env = process.env) {
  const mode = env.AI_MODE || (env.RAG_GENERATOR_URL ? 'http' : 'offline');
  if (!['offline', 'http', 'dual'].includes(mode)) throw new Error('AI_MODE must be offline, http or dual');
  if (mode === 'http' && !env.RAG_GENERATOR_URL) throw new Error('RAG_GENERATOR_URL is required in http mode');
  if (mode === 'dual') for (const name of ['GEMINI_API_KEY', 'GEMINI_MODEL', 'OPENAI_API_KEY', 'OPENAI_MODEL']) {
    if (!env[name]?.trim()) throw new Error(`${name} is required in dual mode`);
  }
  return { mode, url: env.RAG_GENERATOR_URL, token: env.RAG_GENERATOR_TOKEN,
    geminiKey: env.GEMINI_API_KEY, geminiModel: env.GEMINI_MODEL,
    openaiKey: env.OPENAI_API_KEY, openaiModel: env.OPENAI_MODEL };
}

export function createConfiguredGenerator(config, options = {}) {
  if (config.mode === 'offline') return null;
  if (config.mode === 'http') return createHttpRagGenerator({ url: config.url, token: config.token, fetchImpl: options.fetchImpl });
  return createAiGateway({ ...options, providers: [
    createGeminiProvider({ key: config.geminiKey, model: config.geminiModel, fetchImpl: options.fetchImpl }),
    createOpenAiProvider({ key: config.openaiKey, model: config.openaiModel, fetchImpl: options.fetchImpl }),
  ] });
}

const runtimeKey = Symbol.for('smb.ai.runtime.v1');
export function getRuntimeGenerator() {
  // One per process, including across Next.js development module reloads. Restart to change secrets/config.
  const state = globalThis[runtimeKey] ??= {};
  if (!Object.hasOwn(state, 'generator')) state.generator = createConfiguredGenerator(readAiConfig());
  return state.generator;
}

export function withConfiguredGenerator(options = {}) {
  if (Object.hasOwn(options, 'generator') || options.generateReply) return options;
  return { ...options, generator: getRuntimeGenerator() };
}
