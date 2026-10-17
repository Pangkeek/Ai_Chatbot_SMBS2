import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { handleApiRequest } from '../src/lib/apiRuntime.js';
import { createRequestHandler } from '../src/lib/app.js';

test('maintenance blocks API requests before DB/auth/body; health still checks DB', async () => {
  const previous = process.env.APP_MAINTENANCE_MODE;
  process.env.APP_MAINTENANCE_MODE = 'true';
  let queries = 0;
  const handler = createRequestHandler({ query: async () => { queries++; return { rows: [{ value: 1 }] }; } }, { worker: {} });
  const server = createServer((req, res) => req.url === '/health' || req.url.startsWith('/direct/') ? handler(req, res) : handleApiRequest(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const [method, path] of [['POST', '/api/v1/auth/register'], ['POST', '/api/v1/shops/test/line/webhook'], ['POST', '/api/v1/shops/test/line/simulate'], ['GET', '/api/v1/shops'], ['DELETE', '/api/v1/shops/test'], ['POST', '/direct/register']]) {
      const response = await fetch(base + path, { method, ...(method === 'POST' ? { body: '{invalid' } : {}) });
      assert.equal(response.status, 503);
      assert.equal(response.headers.get('retry-after'), '60');
      assert.equal((await response.json()).error.code, 'MAINTENANCE_MODE');
    }
    assert.equal(queries, 0);
    assert.equal((await fetch(base + '/health')).status, 200);
    assert.ok(queries > 0);
    process.env.APP_MAINTENANCE_MODE = 'false';
    const response = await fetch(base + '/health');
    assert.equal(response.status, 200);
  } finally {
    await new Promise(resolve => server.close(resolve));
    if (previous === undefined) delete process.env.APP_MAINTENANCE_MODE;
    else process.env.APP_MAINTENANCE_MODE = previous;
  }
});

test('maintenance prevents worker initialization even when worker flag is true', () => {
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', "import { registerLineRuntime } from './src/lib/lineRuntime.js'; registerLineRuntime();"], {
    cwd: process.cwd(), env: { ...process.env, APP_MAINTENANCE_MODE: 'true', LINE_WORKER_ENABLED: 'true', DATABASE_URL: '', NEXT_MANUAL_SIG_HANDLE: '0' }, encoding: 'utf8', timeout: 5000,
  });
  assert.equal(child.status, 0);
  assert.equal(child.stderr, '');
});
