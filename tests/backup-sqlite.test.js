import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../scripts/sqlite/database.js';
import { seedDemo } from './fixtures/sqlite-seed.js';
import { backupSqlite, sha256 } from '../scripts/backup-sqlite.js';

test('backup includes committed WAL data, preserves source, verifies and never overwrites snapshots', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sqlite-backup-test-'));
  let db;
  try {
    const source = join(dir, 'source.sqlite');
    db = openDatabase(source);
    db.exec('PRAGMA wal_autocheckpoint = 0');
    await seedDemo(db);
    db.prepare("UPDATE shops SET name = 'WAL-only sentinel' WHERE id = 'shop-coffee'").run();
    const before = await Promise.all([sha256(source), sha256(`${source}-wal`)]);
    const options = { source, outputDir: join(dir, 'backups') };
    const first = await backupSqlite(options);
    const second = await backupSqlite(options);
    assert.notEqual(first.manifest.snapshot, second.manifest.snapshot);
    assert.deepEqual(await Promise.all([sha256(source), sha256(`${source}-wal`)]), before);
    assert.equal(await sha256(first.manifest.snapshot), first.manifest.sha256);
    assert.equal(first.manifest.counts.shops, 2);
    assert.equal(first.manifest.migrations.length, 4);
    assert.equal(first.manifest.valid, true);
    assert.deepEqual(first.manifest.missingMigrations, []);
    const copy = new DatabaseSync(first.manifest.snapshot, { readOnly: true });
    try { assert.equal(copy.prepare("SELECT name FROM shops WHERE id = 'shop-coffee'").get().name, 'WAL-only sentinel'); } finally { copy.close(); }
    const manifestText = readFileSync(first.manifestPath, 'utf8');
    for (const secret of ['WAL-only sentinel', 'coffee@example.test', 'password_hash', 'token_hash', 'channel_secret', 'reply_token']) assert.equal(manifestText.includes(secret), false);
    db.prepare("UPDATE schema_migrations SET checksum = 'tampered' WHERE version LIKE '001%'").run();
    await assert.rejects(backupSqlite(options), /verification failed/);
  } finally {
    db?.close();
    // Only the exact temporary fixture directory allocated above is removed.
    rmSync(dir, { recursive: true, force: true });
  }
});

test('missing source fails without creating an empty database or backup directory', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sqlite-backup-missing-'));
  try {
    const source = join(dir, 'missing.sqlite');
    const outputDir = join(dir, 'backups');
    await assert.rejects(backupSqlite({ source, outputDir }), /ENOENT/);
    assert.equal(existsSync(source), false);
    assert.equal(existsSync(outputDir), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
