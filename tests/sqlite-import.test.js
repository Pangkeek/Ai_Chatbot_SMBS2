import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { openDatabase } from '../scripts/sqlite/database.js';
import { seedDemo as seedSqlite } from './fixtures/sqlite-seed.js';
import { backupSqlite, sha256 } from '../scripts/backup-sqlite.js';
import { transferSqlite, tables } from '../scripts/sqlite/transfer.js';
import { withTestSchema } from '../integration/postgresql-fixture.js';
import { migratePostgresql } from '../scripts/postgresql/migrations.js';
import { createService } from '../src/services/service.js';
import { tokenHash } from '../src/lib/auth.js';

async function withSource(action, change) {
  const dir = mkdtempSync(join(tmpdir(), 'sqlite-import-'));
  let db;
  try {
    db = openDatabase(join(dir, 'original.sqlite'));
    await seedSqlite(db);
    const token = randomBytes(32).toString('base64url');
    db.prepare('INSERT INTO sessions VALUES (?,?,?,?)').run(tokenHash(token), 'user-coffee', '2099-01-01T00:00:00.000Z', '2026-10-06T00:00:00.000Z');
    db.prepare('INSERT INTO line_channels VALUES (?,?,?,?,?,?,?)').run('shop-coffee', null, 'secret-never-log', 'token-never-log', null, '2026-10-06T00:00:00.000Z', '2026-10-06T00:00:00.000Z');
    db.prepare('INSERT INTO line_events VALUES (?,?,?,?,?,?)').run('unresolved-old-event', 'shop-coffee', 'message', 'reply-never-log', 'processing', '2026-10-06T00:00:00.000Z');
    db.prepare("UPDATE messages SET content=? WHERE id='shop-coffee-message-1'").run('ไทย 🌺\n' + 'ยาว'.repeat(3000));
    await change?.(db);
    const backup = await backupSqlite({ source: join(dir, 'original.sqlite'), outputDir: join(dir, 'backups') });
    db.close(); db = null;
    await action({ sourcePath: backup.manifest.snapshot, outputDir: join(dir, 'reports'), token, dir, backup });
  } finally { db?.close(); rmSync(dir, { recursive: true, force: true }); }
}

const counts = async db => Object.fromEntries(await Promise.all(tables.map(async table => [table.name, (await db.query(`SELECT count(*) FROM ${table.name}`)).rows[0].count])));

test('dry-run makes no target writes; import/verify preserve rows, Unicode, secrets, sessions and old events', async () => withSource(async source => withTestSchema(async ({ db, config }) => {
  await migratePostgresql({ config });
  const history = (await db.query('SELECT * FROM schema_migrations ORDER BY version')).rows;
  const original = await sha256(source.sourcePath);
  const options = { sourcePath: source.sourcePath, outputDir: source.outputDir, config, batchSize: 1 };
  const dry = await transferSqlite({ ...options, mode: 'dry-run' });
  assert.equal(dry.manifest.status, 'passed');
  assert.ok(Object.values(await counts(db)).every(value => value === '0'));
  assert.deepEqual((await db.query('SELECT * FROM schema_migrations ORDER BY version')).rows, history);
  const imported = await transferSqlite({ ...options, mode: 'import' });
  assert.equal(imported.manifest.transactionState, 'committed');
  assert.ok(Object.values(imported.manifest.verification).every(value => value.match));
  assert.equal(imported.manifest.lineJobsCount, 0);
  assert.deepEqual(imported.manifest.unresolvedLineHistory.counts, [{ status: 'processing', count: 1 }]);
  const verified = await transferSqlite({ ...options, mode: 'verify' });
  assert.equal(verified.manifest.status, 'passed');
  assert.deepEqual(verified.manifest.targetTables, imported.manifest.targetTables);
  assert.equal((await db.query("SELECT status,reply_token FROM line_events WHERE event_id='unresolved-old-event'")).rows[0].status, 'processing');
  assert.equal((await db.query('SELECT * FROM line_jobs')).rowCount, 0);
  const channel = (await db.query("SELECT * FROM line_channels WHERE shop_id='shop-coffee'")).rows[0];
  assert.equal(channel.channel_secret, 'secret-never-log'); assert.equal(channel.channel_id, null);
  const originalHash = (await db.query("SELECT password_hash FROM users WHERE id='user-coffee'")).rows[0].password_hash;
  const service = createService(db);
  assert.equal((await service.login({ body: { email: 'COFFEE@example.test', password: 'DemoPass!2026' } })).data.user.id, 'user-coffee');
  assert.equal((await db.query("SELECT password_hash FROM users WHERE id='user-coffee'")).rows[0].password_hash, originalHash);
  assert.equal((await db.query('SELECT * FROM sessions WHERE token_hash=$1', [tokenHash(source.token)])).rows[0].user_id, 'user-coffee');
  await service.logout({ sessionHash: tokenHash(source.token) });
  assert.equal((await db.query('SELECT * FROM sessions WHERE token_hash=$1', [tokenHash(source.token)])).rowCount, 0);
  const receipt = readFileSync(imported.manifestPath, 'utf8');
  for (const secret of ['secret-never-log','token-never-log','reply-never-log',originalHash,tokenHash(source.token),source.token,'coffee@example.test','local-development-only']) assert.equal(receipt.includes(secret), false);
  assert.deepEqual((await db.query('SELECT * FROM schema_migrations ORDER BY version')).rows, history);
  assert.equal(await sha256(source.sourcePath), original);
  await assert.rejects(transferSqlite({ ...options, mode: 'import' }), /Target must have empty/);
})));

test('failure after several inserted tables rolls back everything; retry succeeds without reset', async () => withSource(async source => withTestSchema(async ({ db, config }) => {
  await migratePostgresql({ config });
  await db.query("CREATE FUNCTION fail_import() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'secret-never-log'; END $$");
  await db.query('CREATE TRIGGER fail_message BEFORE INSERT ON messages FOR EACH ROW EXECUTE FUNCTION fail_import()');
  const options = { sourcePath: source.sourcePath, outputDir: source.outputDir, config, mode: 'import', batchSize: 1 };
  let receipt;
  await assert.rejects(transferSqlite(options), error => { receipt = JSON.parse(readFileSync(error.manifestPath, 'utf8')); return error.message.includes('messages'); });
  assert.equal(receipt.transactionState, 'rolled-back');
  assert.equal(JSON.stringify(receipt).includes('secret-never-log'), false);
  assert.ok(Object.values(await counts(db)).every(value => value === '0'));
  await db.query('DROP TRIGGER fail_message ON messages');
  assert.equal((await transferSqlite(options)).manifest.status, 'passed');
})));

test('verify detects changed content and unchanged-count mutations without modifying target', async () => withSource(async source => withTestSchema(async ({ db, config }) => {
  await migratePostgresql({ config });
  const options = { sourcePath: source.sourcePath, outputDir: source.outputDir, config };
  await transferSqlite({ ...options, mode: 'import' });
  await db.query("UPDATE messages SET content='changed' WHERE id='shop-coffee-message-1'");
  await assert.rejects(transferSqlite({ ...options, mode: 'verify' }), /counts\/checksums differ/);
  assert.equal((await db.query("SELECT content FROM messages WHERE id='shop-coffee-message-1'")).rows[0].content, 'changed');
})));

test('source checksum tampering, missing source and missing target migrations fail safely', async () => withSource(async source => withTestSchema(async ({ db, config }) => {
  const options = { sourcePath: source.sourcePath, outputDir: source.outputDir, config };
  await assert.rejects(transferSqlite(options), /migration readiness/);
  await migratePostgresql({ config });
  await assert.rejects(transferSqlite({ ...options, sourcePath: join(source.dir, 'missing.sqlite') }), /does not exist/);
  const manifestPath = join(source.sourcePath, '..', 'manifest.json');
  const receipt = JSON.parse(readFileSync(manifestPath, 'utf8')); receipt.sha256 = '0'.repeat(64); writeFileSync(manifestPath, JSON.stringify(receipt));
  await assert.rejects(transferSqlite(options), /checksum or backup manifest/);
  assert.ok(Object.values(await counts(db)).every(value => value === '0'));
})));

test('NUL source values fail with table/key fingerprint, without fixing the source', async () => withSource(async source => withTestSchema(async ({ db, config }) => {
  await migratePostgresql({ config });
  const before = await sha256(source.sourcePath);
  await assert.rejects(transferSqlite({ sourcePath: source.sourcePath, outputDir: source.outputDir, config }), error => {
    assert.equal(error.issues[0].table, 'messages'); assert.equal(error.issues[0].reason, 'nul_not_supported_by_postgresql');
    assert.match(error.issues[0].keySha256, /^[a-f0-9]{64}$/); return true;
  });
  assert.equal(await sha256(source.sourcePath), before);
  assert.ok(Object.values(await counts(db)).every(value => value === '0'));
}), db => db.prepare("UPDATE messages SET content=? WHERE id='shop-coffee-message-1'").run('invalid\0text')));

test('server-side interruption discards the entire import and allows a clean retry', async () => withSource(async source => withTestSchema(async ({ db, config }) => {
  await migratePostgresql({ config });
  await db.query('CREATE FUNCTION kill_import() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_terminate_backend(pg_backend_pid()); RETURN NEW; END $$');
  await db.query('CREATE TRIGGER interrupt_import BEFORE INSERT ON messages FOR EACH ROW EXECUTE FUNCTION kill_import()');
  const options = { sourcePath: source.sourcePath, outputDir: source.outputDir, config, mode: 'import' };
  await assert.rejects(transferSqlite(options), /Import failed in table messages/);
  assert.ok(Object.values(await counts(db)).every(value => value === '0'));
  await db.query('DROP TRIGGER interrupt_import ON messages');
  assert.equal((await transferSqlite(options)).manifest.status, 'passed');
})));

test('concurrent import commits once; live sources, WAL snapshots and target checksum drift are rejected', async () => withSource(async source => withTestSchema(async ({ db, config }) => {
  await migratePostgresql({ config });
  const options = { sourcePath: source.sourcePath, outputDir: source.outputDir, config, mode: 'import' };
  const saved = process.env.DATABASE_PATH;
  process.env.DATABASE_PATH = source.sourcePath;
  try { await assert.rejects(transferSqlite(options), /Live SQLite source/); }
  finally { if (saved === undefined) delete process.env.DATABASE_PATH; else process.env.DATABASE_PATH = saved; }
  writeFileSync(`${source.sourcePath}-wal`, 'fake active WAL');
  try { await assert.rejects(transferSqlite(options), /WAL data/); }
  finally { rmSync(`${source.sourcePath}-wal`); }
  await db.query("UPDATE schema_migrations SET checksum=repeat('0',64) WHERE version='001_initial.sql'");
  await assert.rejects(transferSqlite(options), /migration checksums/);
  const { readMigrations } = await import('../scripts/postgresql/migrations.js');
  await db.query("UPDATE schema_migrations SET checksum=$1 WHERE version='001_initial.sql'", [(await readMigrations())[0].checksum]);
  const runs = await Promise.allSettled([transferSqlite(options), transferSqlite(options)]);
  assert.equal(runs.filter(run => run.status === 'fulfilled').length, 1);
  assert.match(runs.find(run => run.status === 'rejected').reason.message, /Target must have empty/);
  assert.equal((await db.query('SELECT count(*) FROM users')).rows[0].count, '2');
})));
