import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase, transaction, getRuntimeDatabase, closeRuntimeDatabase } from '../src/lib/db.js';
import { withTestSchema } from './postgresql-fixture.js';
import { migratePostgresql } from '../scripts/postgresql/migrations.js';

// Fail, never skip, when a dedicated test database has not been supplied.
const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error('TEST_DATABASE_URL is required for PostgreSQL integration tests');
const target = new URL(connectionString);
if (target.pathname !== '/chatbot_test' || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)) throw new Error('Integration tests require a loopback chatbot_test database');
if (process.env.DATABASE_URL) {
  const runtime = new URL(process.env.DATABASE_URL);
  if (runtime.port === target.port && runtime.pathname === target.pathname) throw new Error('Test database must differ from DATABASE_URL');
}
const config = { connectionString, sslMode: 'disable', max: 1, connectTimeoutMs: 1000, queryTimeoutMs: 2000 };

test('PostgreSQL 18 concurrent queries, transactions, rollback recovery, timeouts, and close', async () => {
  const db = await openDatabase(config);
  const table = `phase_b_${randomUUID().replaceAll('-', '')}`;
  try {
    const version = await db.query('SHOW server_version_num');
    assert.equal(Math.floor(Number(version.rows[0].server_version_num) / 10000), 18);
    await db.query(`CREATE TABLE ${table} (id integer PRIMARY KEY, value text NOT NULL)`);
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => db.query('SELECT $1::int AS value', [i])));
    assert.deepEqual(results.map(result => result.rows[0].value), Array.from({ length: 12 }, (_, i) => i));
    let captured;
    assert.equal(await transaction(db, async tx => {
      captured = tx;
      await tx.query(`INSERT INTO ${table} VALUES ($1, $2)`, [1, 'ไทย']);
      await new Promise(resolve => setTimeout(resolve, 10));
      return (await tx.query(`SELECT value FROM ${table} WHERE id = 1`)).rows[0].value;
    }), 'ไทย');
    await assert.rejects(captured.query('SELECT 1'), /ended/);
    await assert.rejects(transaction(db, async tx => {
      await tx.query(`INSERT INTO ${table} VALUES (2, 'rollback')`);
      throw new Error('callback failed');
    }), /callback failed/);
    assert.equal((await db.query(`SELECT * FROM ${table} WHERE id = 2`)).rowCount, 0);
    await assert.rejects(transaction(db, async tx => {
      await tx.query(`INSERT INTO ${table} VALUES (2, 'rollback')`);
      await tx.query(`INSERT INTO ${table} VALUES (1, 'duplicate')`);
    }), { code: '23505' });
    await assert.rejects(transaction(db, async () => db.query('SELECT 1')), /Use tx.query/);
    await assert.rejects(transaction(db, async () => transaction(db, async () => {})), /nested transactions/);
    await assert.rejects(transaction(db, async tx => {
      try { await tx.query('SELECT 1 / 0'); } catch { /* Deliberately swallowed to test aborted COMMIT. */ }
    }), /aborted/);
    // Server cancellation leaves this single-client pool usable after rollback.
    await assert.rejects(transaction(db, async tx => {
      await tx.query("SET LOCAL statement_timeout = '30ms'");
      await tx.query('SELECT pg_sleep(1)');
    }), { code: '57014' });
    assert.equal((await db.query(`SELECT * FROM ${table}`)).rowCount, 1);
    // A dead transaction connection makes ROLLBACK fail; discard it and acquire a new one.
    await assert.rejects(transaction(db, async tx => {
      await tx.query('SELECT pg_terminate_backend(pg_backend_pid())');
    }));
    assert.equal((await db.query('SELECT 1 AS recovered')).rows[0].recovered, 1);
  } finally {
    try { await db.query(`DROP TABLE IF EXISTS ${table}`); } finally { await db.close(); }
  }
  await db.close();
  await assert.rejects(db.query('SELECT 1'), /closed/);
  await assert.rejects(openDatabase({ ...config, connectionString: 'postgresql://secret:do-not-log@127.0.0.1:1/chatbot_test', connectTimeoutMs: 100 }), error => error.message.includes('connection failed') && !error.message.includes('do-not-log'));
});

test('runtime initialization requires migrations, shares concurrent callers/hot reload, and can reopen', async () => withTestSchema(async ({ config, schema }) => {
  const saved = { DATABASE_URL: process.env.DATABASE_URL, DB_SSL_MODE: process.env.DB_SSL_MODE, DB_SCHEMA: process.env.DB_SCHEMA };
  process.env.DATABASE_URL = connectionString;
  process.env.DB_SSL_MODE = 'disable';
  process.env.DB_SCHEMA = schema;
  try {
    await assert.rejects(getRuntimeDatabase(), /schema is not ready/);
    await migratePostgresql({ config });
    const first = getRuntimeDatabase();
    assert.equal(first, getRuntimeDatabase());
    const db = await first;
    const reloaded = await import(`../src/lib/db.js?reload=${randomUUID()}`);
    assert.equal(db, await reloaded.getRuntimeDatabase());
    await closeRuntimeDatabase();
    assert.notEqual(db, await getRuntimeDatabase());
  } finally {
    await closeRuntimeDatabase();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}));
