import pg from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';
import { schemaName, assertSchemaReady } from './postgresql-schema.js';

const stateKey = Symbol.for('smb.postgresql.runtime.v1');
const state = globalThis[stateKey] ??= { pending: null, transactions: new AsyncLocalStorage() };

function positiveInteger(value, fallback, name) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw new Error(`${name} must be a positive integer`);
  return number;
}

export function databaseConfig(config = {}, env = process.env) {
  const connectionString = config.connectionString ?? env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required; configure PostgreSQL before opening the database');
  let url;
  try { url = new URL(connectionString); } catch { throw new Error('DATABASE_URL must be a PostgreSQL URL'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length < 2) throw new Error('DATABASE_URL must name a PostgreSQL host and database');
  // URL parameters override pg SSL/client settings; configure these in one place only.
  if (url.search) throw new Error('DATABASE_URL query parameters are not supported; use DB_SSL_MODE and DB_* settings');
  const sslMode = config.sslMode ?? env.DB_SSL_MODE ?? 'verify-full';
  if (!['disable', 'require', 'verify-full'].includes(sslMode)) throw new Error('DB_SSL_MODE must be disable, require, or verify-full');
  if (sslMode === 'disable' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('DB_SSL_MODE=disable is allowed only for a loopback database');
  return {
    connectionString,
    ssl: sslMode === 'disable' ? false : { rejectUnauthorized: sslMode === 'verify-full' },
    max: positiveInteger(config.max ?? env.DB_POOL_MAX, 5, 'DB_POOL_MAX'),
    connectionTimeoutMillis: positiveInteger(config.connectTimeoutMs ?? env.DB_CONNECT_TIMEOUT_MS, 5000, 'DB_CONNECT_TIMEOUT_MS'),
    statement_timeout: positiveInteger(config.queryTimeoutMs ?? env.DB_QUERY_TIMEOUT_MS, 10000, 'DB_QUERY_TIMEOUT_MS'),
    application_name: 'smb-chatbot',
    options: `-c search_path=${schemaName(config.schema ?? env.DB_SCHEMA ?? 'public')} -c timezone=UTC`,
  };
}

export async function openDatabase(config = {}) {
  const pool = new pg.Pool(databaseConfig(config));
  pool.on('error', () => console.error('PostgreSQL idle connection failed'));
  let closing;
  const close = () => closing ??= pool.end();
  try { await pool.query('SELECT 1'); } catch {
    await close();
    throw new Error('PostgreSQL connection failed; check DATABASE_URL, TLS, and server availability');
  }
  const ensureAvailable = () => {
    if (closing) throw new Error('Database is closed');
    if (state.transactions.getStore()?.has(db)) throw new Error('Use tx.query inside a transaction; pool queries and nested transactions are not allowed');
  };
  const db = {
    async query(sql, params = []) { ensureAvailable(); return pool.query(sql, params); },
    close() {
      if (state.transactions.getStore()?.has(db)) throw new Error('Cannot close a database inside its transaction');
      return close();
    },
    async transaction(action) {
      ensureAvailable();
      const client = await pool.connect();
      let discard = false;
      const onClientError = () => { discard = true; };
      client.on('error', onClientError);
      let active = true;
      const tx = { async query(sql, params = []) {
        if (!active) throw new Error('Transaction has ended');
        return client.query(sql, params);
      } };
      try {
        await client.query('BEGIN');
        const context = new Set(state.transactions.getStore() ?? []);
        context.add(db);
        const result = await state.transactions.run(context, () => action(tx));
        const committed = await client.query('COMMIT');
        if (committed.command !== 'COMMIT') throw new Error('Transaction was aborted and could not commit');
        return result;
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch { discard = true; }
        throw error;
      } finally {
        active = false;
        client.release(discard);
        client.removeListener('error', onClientError);
      }
    },
  };
  return db;
}

export function transaction(db, action) { return db.transaction(action); }

// Phase D calls this lazily: importing this module never connects, migrates, or seeds.
export function getRuntimeDatabase() {
  if (!state.pending) state.pending = openDatabase().then(async db => {
    try { await assertSchemaReady(db); return db; } catch (error) { await db.close(); throw error; }
  }).catch(error => { state.pending = null; throw error; });
  return state.pending;
}

export async function closeRuntimeDatabase() {
  const pending = state.pending;
  if (!pending) return;
  try { await (await pending).close(); } finally { if (state.pending === pending) state.pending = null; }
}
