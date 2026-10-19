const answerSchema = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    sourceChunkIds: { type: 'array', items: { type: 'string' } },
    insufficient: { type: 'boolean' },
  },
  required: ['text', 'sourceChunkIds', 'insufficient'],
  additionalProperties: false,
};

export class AiProviderError extends Error {
  constructor(code, retryable = false) {
    super(code);
    this.code = code;
    this.retryable = retryable;
  }
}

async function readResponse(response) {
  if (!response.ok) {
    const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
    throw new AiProviderError(`AI_HTTP_${response.status}`, retryable);
  }
  try { return await response.json(); }
  catch { throw new AiProviderError('AI_INVALID_JSON'); }
}

function checkedAnswer(value, context) {
  if (!value || typeof value !== 'object') throw new AiProviderError('AI_INVALID_ANSWER');
  if (value.insufficient === true) return { insufficient: true };
  const ids = value.sourceChunkIds;
  const text = value.text?.trim();
  const source = context.find(row => row.chunkId === ids?.[0]);
  // ตรวจหลักฐานก่อนเลือกสำรอง ไม่ปล่อยคำตอบที่อ้างแหล่งผิดไปถึง LINE
  if (typeof text !== 'string' || !text || text.length > 5000 || !Array.isArray(ids) || ids.length !== 1 ||
      !source || !source.content.includes(text)) throw new AiProviderError('AI_UNSUPPORTED_ANSWER');
  return { text, sourceChunkIds: ids };
}

export function createGeminiProvider({ apiKey, model = 'gemini-3.6-flash', fetchImpl = fetch }) {
  if (!apiKey) return null;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  return {
    name: 'gemini', model,
    async generate({ prompt, context }, signal) {
      const response = await fetchImpl(endpoint, {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: prompt.messages[0].content }] },
          contents: [{ role: 'user', parts: [{ text: prompt.messages[1].content }] }],
          generationConfig: { responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: answerSchema } } },
        }),
      });
      const data = await readResponse(response);
      const output = data.candidates?.[0]?.content?.parts?.filter(part => typeof part.text === 'string').map(part => part.text).join('');
      if (!output) throw new AiProviderError('AI_EMPTY_ANSWER');
      try { return checkedAnswer(JSON.parse(output), context); }
      catch (error) { if (error instanceof AiProviderError) throw error; throw new AiProviderError('AI_INVALID_ANSWER'); }
    },
  };
}

export function createOpenAiProvider({ apiKey, model = 'gpt-5.6-luna', fetchImpl = fetch,
  endpoint = 'https://api.openai.com/v1/responses', name = 'openai' }) {
  if (!apiKey) return null;
  return {
    name, model,
    async generate({ prompt, context }, signal) {
      const response = await fetchImpl(endpoint, {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model, store: false,
          input: [{ role: 'developer', content: prompt.messages[0].content },
            { role: 'user', content: prompt.messages[1].content }],
          text: { format: { type: 'json_schema', name: 'grounded_shop_answer', strict: true, schema: answerSchema } },
        }),
      });
      const data = await readResponse(response);
      if (data.status !== 'completed') throw new AiProviderError('AI_INCOMPLETE_ANSWER');
      const output = data.output?.filter(item => item.type === 'message')
        .flatMap(item => item.content || []).filter(item => item.type === 'output_text')
        .map(item => item.text).join('');
      if (!output) throw new AiProviderError('AI_EMPTY_ANSWER');
      try { return checkedAnswer(JSON.parse(output), context); }
      catch (error) { if (error instanceof AiProviderError) throw error; throw new AiProviderError('AI_INVALID_ANSWER'); }
    },
  };
}

export function createBuddyShareGeminiProvider({ apiKey, model = 'gemini-3.1-flash-lite',
  fetchImpl = fetch }) {
  // BuddyShare ใช้ Responses API แต่คีย์นี้ไม่ใช่ Google Gemini API key
  return createOpenAiProvider({ apiKey, model, fetchImpl,
    endpoint: 'https://router.buddyshare.cloud/v1/responses', name: 'buddyshare-gemini' });
}
