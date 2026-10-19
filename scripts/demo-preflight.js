const address = process.argv[2];
if (!address) {
  console.error('Usage: npm run demo:preflight -- https://your-staging.example');
  process.exitCode = 2;
} else {
  try {
    const base = new URL(address);
    if (!['https:', 'http:'].includes(base.protocol) || (base.protocol === 'http:' &&
      !['localhost', '127.0.0.1'].includes(base.hostname))) throw new Error('Use HTTPS, or local HTTP');
    const checks = [];
    for (const path of ['/api/health', '/health', '/app', '/api/openapi']) {
      try {
        const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(10000) });
        checks.push({ path, status: response.status, ok: response.ok });
      } catch {
        checks.push({ path, status: null, ok: false });
      }
    }
    console.log(JSON.stringify({ origin: base.origin, checks }, null, 2));
    if (checks.some(check => !check.ok)) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
