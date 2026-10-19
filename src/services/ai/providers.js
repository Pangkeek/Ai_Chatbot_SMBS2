import { answerSchema } from './answerValidation.js';

export class AiError extends Error {
  constructor(code, { retryable = false, retryAfterMs = 0 } = {}) {
    super(code);
    this.code = code;
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
  }
}

async function requestJson(fetchImpl, url, options) {
  const response = await fetchImpl(url, { ...options, redirect: 'error' });
  if (!response.ok) {
    const retryAfter = response.headers.get('retry-after');
    const seconds = retryAfter && /^\d+(\.\d+)?$/.test(retryAfter) ? Number(retryAfter) : null;
    const retryAfterMs = seconds !== null ? seconds * 1000 : Math.max(0, Date.parse(retryAfter) - Date.now()) || 0;
    // Do not include upstream bodies, headers, URLs or credentials in errors/logs.
    await response.body?.cancel();
    throw new AiError(`AI_HTTP_${response.status}`, {
      retryable: [408, 429].includes(response.status) || response.status >= 500,
      retryAfterMs,
    });
  }
  let result;
  try { result = await response.json(); }
  catch (error) {
    if (options.signal?.aborted || error instanceof TypeError || error?.code) throw error;
    throw new AiError('AI_INVALID_JSON');
  }
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new AiError('AI_INVALID_RESPONSE');
  return result;
}

function parseAnswer(text) {
  try { return JSON.parse(text); } catch { throw new AiError('AI_INVALID_JSON'); }
}

export function createGeminiProvider({ key, model, fetchImpl = fetch }) {
  return {
    name: 'gemini', model,
    async generate({ prompt, signal }) {
      const result = await requestJson(fetchImpl,
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST', signal,
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: prompt.messages[0].content }] },
            contents: [{ role: 'user', parts: [{ text: prompt.messages[1].content }] }],
            generationConfig: { responseMimeType: 'application/json', responseJsonSchema: answerSchema, maxOutputTokens: 8192 },
          }),
        });
      const candidate = result.candidates?.[0];
      if (result.promptFeedback?.blockReason || ['SAFETY', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'RECITATION'].includes(candidate?.finishReason)) {
        throw new AiError('AI_SAFETY_REFUSAL');
      }
      if (candidate?.finishReason !== 'STOP') throw new AiError('AI_INCOMPLETE');
      const parts = candidate.content?.parts;
      if (!Array.isArray(parts)) throw new AiError('AI_INVALID_RESPONSE');
      return parseAnswer(parts.filter(part => part && !part.thought && typeof part.text === 'string').map(part => part.text).join(''));
    },
  };
}

export function createOpenAiProvider({ key, model, fetchImpl = fetch,
  endpoint = 'https://api.openai.com/v1/responses', name = 'openai', acceptChatCompletions = false }) {
  return {
    name, model,
    async generate({ prompt, signal }) {
      const result = await requestJson(fetchImpl, endpoint, {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, store: false, input: acceptChatCompletions
          ? [{ role: 'developer', content: prompt.messages[0].content }, prompt.messages[1]] : prompt.messages,
          text: { format: { type: 'json_schema', name: 'grounded_answer', strict: true, schema: answerSchema } },
          max_output_tokens: 8192,
        }),
      });
      const content = (Array.isArray(result.output) ? result.output : []).filter(item => item?.type === 'message')
        .flatMap(item => Array.isArray(item.content) ? item.content : []).filter(Boolean);
      if (content.some(part => part.type === 'refusal') || result.incomplete_details?.reason === 'content_filter') throw new AiError('AI_SAFETY_REFUSAL');
      if (acceptChatCompletions && result.status !== 'completed' && Array.isArray(result.choices)) {
        const choice = result.choices[0];
        if (choice?.message?.refusal || choice?.finish_reason === 'content_filter') throw new AiError('AI_SAFETY_REFUSAL');
        if (choice?.finish_reason !== 'stop') throw new AiError('AI_INCOMPLETE');
        const text = choice.message?.content;
        if (typeof text !== 'string') throw new AiError('AI_INVALID_RESPONSE');
        const fence = /^\x60{3}(?:json)?\s*\n([\s\S]*?)\n\x60{3}$/i.exec(text.trim());
        return parseAnswer(fence ? fence[1] : text);
      }
      if (result.status !== 'completed') throw new AiError('AI_INCOMPLETE');
      return parseAnswer(content.filter(part => part.type === 'output_text' && typeof part.text === 'string').map(part => part.text).join(''));
    },
  };
}

export function createBuddyShareGeminiProvider({ key, model = 'gemini-3.1-flash-lite', fetchImpl = fetch }) {
  return createOpenAiProvider({ key, model, fetchImpl, name: 'buddyshare-gemini',
    endpoint: 'https://router.buddyshare.cloud/v1/responses', acceptChatCompletions: true });
}
