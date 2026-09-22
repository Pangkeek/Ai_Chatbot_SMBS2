import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/lib/db.js';
import { seedDemo } from '../src/lib/seed.js';

test('disk database survives restart; migrations are tracked and reject edits', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'smb-chatbot-test-'));
  const path = join(dir, 'db.sqlite');
  let db;
  try {
    db = openDatabase(path);
    await seedDemo(db);
    db.prepare("UPDATE shops SET name = 'Persisted name' WHERE id = 'shop-coffee'").run();
    db.close();
    db = openDatabase(path);
    assert.equal(db.prepare('SELECT count(*) AS n FROM schema_migrations').get().n, 3);
    assert.equal(db.prepare("SELECT name FROM shops WHERE id = 'shop-coffee'").get().name, 'Persisted name');
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    db.prepare("UPDATE schema_migrations SET checksum = 'changed'").run();
    db.close(); db = null;
    assert.throws(() => openDatabase(path), /Applied migration changed/);
  } finally {
    db?.close();
    // This exact directory is created by mkdtempSync above and contains test data only.
    rmSync(dir, { recursive: true, force: true });
  }
});
