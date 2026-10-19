// Preserve the original (input, signal) adapter interface for ai:check and existing callers.
import { AiError, createBuddyShareGeminiProvider as buddy, createGeminiProvider as gemini,
  createOpenAiProvider as openai } from './ai/providers.js';
import { validateGeneratedAnswer } from './ai/answerValidation.js';

export class AiProviderError extends AiError {
  constructor(code, retryable = false) { super(code, { retryable }); }
}

function adapt(factory, { apiKey, ...options }) {
  if (!apiKey) return null;
  const provider = factory({ ...options, key: apiKey });
  return { name: provider.name, model: provider.model,
    async generate(input, signal) {
      const result = validateGeneratedAnswer(await provider.generate({ ...input, signal }), input.context, { strict: true });
      if (!result) throw new AiProviderError('AI_INVALID_ANSWER');
      return result.insufficient ? { insufficient: true } : { text: result.text, sourceChunkIds: result.sourceChunkIds };
    } };
}

export const createGeminiProvider = options => adapt(gemini, { ...options, model: options.model || 'gemini-3.6-flash' });
export const createOpenAiProvider = options => adapt(openai, { ...options, model: options.model || 'gpt-5.6-luna' });
export const createBuddyShareGeminiProvider = options => adapt(buddy, options);
