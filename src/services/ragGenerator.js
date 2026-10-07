// Provider-neutral HTTP boundary. A configured service may use any AI model,
// but it must return a verbatim excerpt and the ID of its supporting chunk.
export function createHttpRagGenerator({ url, token, fetchImpl = fetch }) {
  if (!url) return null;
  const endpoint = new URL(url);
  if (endpoint.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(endpoint.hostname)) {
    throw new Error('RAG_GENERATOR_URL must use HTTPS outside localhost');
  }
  return {
    async generate({ shopId, query, context, instruction }) {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ shopId, query, context, instruction }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`RAG generator returned ${response.status}`);
      return response.json();
    },
  };
}
