import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const migrationDir = fileURLToPath(new URL('../migrations/', import.meta.url));

export function transaction(db, action) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = action();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function openDatabase(path = process.env.DATABASE_PATH || './data/chatbot.sqlite') {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL
    ) STRICT`);
    for (const version of readdirSync(migrationDir).filter(f => f.endsWith('.sql')).sort()) {
      const sql = readFileSync(resolve(migrationDir, version), 'utf8');
      const checksum = createHash('sha256').update(sql.replaceAll('\r\n', '\n')).digest('hex');
      transaction(db, () => {
        const applied = db.prepare('SELECT checksum FROM schema_migrations WHERE version = ?').get(version);
        if (applied) {
          if (applied.checksum !== checksum) throw new Error(`Applied migration changed: ${version}. Add a new migration instead.`);
          return;
        }
        db.exec(sql);
        db.prepare('INSERT INTO schema_migrations VALUES (?, ?, ?)').run(version, checksum, new Date().toISOString());
      });
    }
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
