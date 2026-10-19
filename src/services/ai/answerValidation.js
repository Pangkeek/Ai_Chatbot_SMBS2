export function validateGeneratedAnswer(value, context, { strict = false } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (strict && (typeof value.insufficient !== 'boolean' ||
      Object.keys(value).some(key => !['text', 'sourceChunkIds', 'insufficient'].includes(key)))) return null;
  if (value?.insufficient === true && value.text === '' &&
      Array.isArray(value.sourceChunkIds) && value.sourceChunkIds.length === 0) {
    return { text: '', sourceChunkIds: [], insufficient: true };
  }
  const ids = value?.sourceChunkIds;
  const text = typeof value?.text === 'string' ? value.text.trim() : '';
  const source = Array.isArray(ids) && ids.length === 1
    ? context.find(item => item.chunkId === ids[0]) : null;
  if (!text || value.insufficient === true || value.text.length > 5000 || !source?.content.includes(text)) return null;
  return { text, sourceChunkIds: ids, insufficient: false };
}

export const answerSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    text: { type: 'string' },
    sourceChunkIds: { type: 'array', items: { type: 'string' } },
    insufficient: { type: 'boolean' },
  },
  required: ['text', 'sourceChunkIds', 'insufficient'],
};
