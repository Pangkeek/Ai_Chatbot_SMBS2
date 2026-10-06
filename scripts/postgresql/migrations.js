import pg from 'pg';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { databaseConfig } from '../../src/lib/db.js';
import { schemaName } from '../../src/lib/postgresql-schema.js';

const defaultDirectory = fileURLToPath(new URL('../../migrations/postgresql/', import.meta.url));

export async function readMigrations(directory = defaultDirectory) {
  const names = (await readdir(directory)).filter(name => name.endsWith('.sql')).sort();
  if (!names.length || names.some(name => !/^\d{3}_[a-z0-9_]+\.sql$/.test(name))) throw new Error('Invalid or empty PostgreSQL migration directory');
  if (new Set(names.map(name => name.slice(0, 3))).size !== names.length) throw new Error('Duplicate PostgreSQL migration number');
  return Promise.all(names.map(async version => {
    const sql = (await readFile(join(directory, version), 'utf8')).replaceAll('\r\n', '\n');
    return { version, sql, checksum: createHash('sha256').update(sql).digest('hex') };
  }));
}

export async function migratePostgresql({ config = {}, directory = defaultDirectory } = {}) {
  const files = await readMigrations(directory);
  const schema = schemaName(config.schema ?? process.env.DB_SCHEMA ?? 'public');
  // Dedicated session owns both advisory lock and every migration transaction.
  const client = new pg.Client(databaseConfig({ ...config, schema }));
  client.on('error', () => {}); // Pending queries reject; never print driver errors containing secrets.
  let locked = false;
  try {
    await client.connect();
    const exists = await client.query('SELECT 1 FROM pg_namespace WHERE nspname = $1', [schema]);
    if (!exists.rowCount) throw new Error('Application schema does not exist; create the intended schema before migrating');
    await client.query('SELECT pg_advisory_lock(1936548461, hashtext($1))', [schema]);
    locked = true;
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT COLLATE "C" PRIMARY KEY,
      checksum TEXT NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now() CHECK (isfinite(applied_at))
    )`);
    const { rows: applied } = await client.query('SELECT version, checksum FROM schema_migrations ORDER BY version');
    // Validate the entire applied history before applying any pending file.
    for (const [index, row] of applied.entries()) {
      if (files[index]?.version !== row.version || files[index]?.checksum !== row.checksum) throw new Error(`Applied migration changed or missing: ${row.version}. Add a new migration instead.`);
    }
    const added = [];
    for (const migration of files.slice(applied.length)) {
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query('INSERT INTO schema_migrations(version, checksum) VALUES ($1, $2)', [migration.version, migration.checksum]);
        await client.query('COMMIT');
        added.push(migration.version);
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw new Error(`PostgreSQL migration failed: ${migration.version}`, { cause: error });
      }
    }
    return { applied: added, skipped: applied.map(row => row.version) };
  } finally {
    if (locked) await client.query('SELECT pg_advisory_unlock(1936548461, hashtext($1))', [schema]).catch(() => {});
    await client.end();
  }
}
