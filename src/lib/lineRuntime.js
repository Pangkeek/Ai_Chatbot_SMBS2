import { getRuntimeDatabase, closeRuntimeDatabase } from './db.js';
import { createLineWorker } from '../services/worker.js';

const key = Symbol.for('smb.line.runtime.v1');
const state = globalThis[key] ??= { worker: null, pending: null, timer: null, stopping: false, registered: false };

export function wakeLineRuntime() { state.worker?.wake(); }

export function registerLineRuntime() {
  if (state.registered) return;
  state.registered = true;
  if (process.env.NEXT_MANUAL_SIG_HANDLE === '1') {
    let exiting = false;
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
      if (exiting) return;
      exiting = true;
      const code = signal === 'SIGINT' ? 130 : 143;
      const deadline = setTimeout(() => process.exit(code), 15000);
      shutdownLineRuntime().finally(() => { clearTimeout(deadline); process.exit(code); });
    });
  }
  if (process.env.LINE_WORKER_ENABLED !== 'true') return;
  // Retry startup without needing incoming traffic, including when DB is briefly down.
  const initialize = async () => {
    if (state.stopping || state.pending || state.worker) return;
    state.pending = getRuntimeDatabase().then(async db => {
      if (state.stopping) return;
      state.worker = createLineWorker(db);
      state.worker.start();
    }).catch(() => {
      console.warn('LINE_JOB RUNTIME_UNAVAILABLE');
      if (!state.stopping) { state.timer = setTimeout(initialize, 1000); state.timer.unref(); }
    }).finally(() => { state.pending = null; });
    await state.pending;
  };
  void initialize();
}

export async function shutdownLineRuntime() {
  state.stopping = true; clearTimeout(state.timer);
  await state.pending;
  await state.worker?.stop();
  state.worker = null;
  await closeRuntimeDatabase();
}
