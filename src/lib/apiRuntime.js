import { randomUUID } from 'node:crypto';
import { rejectMaintenanceRequest } from './maintenance.js';
import { createRequestHandler } from './app.js';
import { getRuntimeDatabase, closeRuntimeDatabase } from './db.js';
import { wakeLineRuntime, shutdownLineRuntime } from './lineRuntime.js';

const key = Symbol.for('smb.api.runtime.postgresql.v1');
const state = globalThis[key] ??= { pending: null };

export async function handleApiRequest(req, res) {
  if (rejectMaintenanceRequest(req, res)) return;
  let handler;
  try {
    state.pending ??= getRuntimeDatabase().then(db => createRequestHandler(db, { worker: {
      wake: wakeLineRuntime,
      drain: async () => {},
    } })).catch(error => { state.pending = null; throw error; });
    handler = await state.pending;
  } catch {
    const requestId = randomUUID();
    res.statusCode = 503;
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    req.resume();
    res.end(JSON.stringify({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Database unavailable', details: [] }, request_id: requestId }));
    return;
  }
  return handler(req, res);
}

export async function closeApiRuntime() {
  try { await shutdownLineRuntime(); }
  finally { state.pending = null; await closeRuntimeDatabase(); }
}
