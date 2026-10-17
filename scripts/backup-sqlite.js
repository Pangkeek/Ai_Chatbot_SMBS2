import { DatabaseSync, backup } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { createReadStream, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const tables = ['users', 'shops', 'shop_memberships', 'sessions', 'knowledge_entries', 'conversations', 'messages', 'line_channels', 'line_events'];
const quote = name => `"${name.replaceAll('"', '""')}"`;

export async function sha256(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

// Inspect the completed snapshot, never migrate or seed the source.
export function inspectSnapshot(db, migrationDir = resolve('migrations')) {
  const counts = Object.fromEntries(tables.map(table => [table, db.prepare(`SELECT count(*) AS n FROM ${quote(table)}`).get().n]));
  const migrations = db.prepare('SELECT version, checksum, applied_at FROM schema_migrations ORDER BY version').all();
  const expected = readdirSync(migrationDir).filter(name => name.endsWith('.sql')).sort();
  const migrationChecks = migrations.map(row => ({
    ...row,
    matchesRepository: expected.includes(row.version) && row.checksum === createHash('sha256').update(readFileSync(join(migrationDir, row.version), 'utf8').replaceAll('\r\n', '\n')).digest('hex'),
  }));
  const timestamps = {};
  for (const table of tables) {
    timestamps[table] = {};
    for (const { name } of db.prepare(`PRAGMA table_info(${quote(table)})`).all().filter(c => c.name.endsWith('_at'))) {
      let invalid = 0;
      for (const row of db.prepare(`SELECT ${quote(name)} AS value FROM ${quote(table)}`).iterate()) {
        const value = row.value;
        if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) invalid++;
      }
      timestamps[table][name] = { ...db.prepare(`SELECT min(${quote(name)}) AS earliest, max(${quote(name)}) AS latest FROM ${quote(table)}`).get(), invalidIsoUtc: invalid };
    }
  }
  const integrity = db.prepare('PRAGMA integrity_check').all().map(row => row.integrity_check);
  const foreignKeyViolations = db.prepare('PRAGMA foreign_key_check').all().length;
  const duplicateEmailGroups = db.prepare('SELECT count(*) AS n FROM (SELECT lower(email) FROM users GROUP BY lower(email) HAVING count(*) > 1)').get().n;
  const eventStatuses = db.prepare('SELECT status, count(*) AS count FROM line_events GROUP BY status ORDER BY status').all();
  // Ordinals deliberately avoid exposing tenant/customer IDs or message text.
  const shopFlows = db.prepare('SELECT id FROM shops ORDER BY id LIMIT 2').all().map(({ id }, index) => ({
    sample: index + 1,
    counts: Object.fromEntries(['shop_memberships', 'knowledge_entries', 'conversations', 'messages', 'line_channels', 'line_events'].map(table => [table, db.prepare(`SELECT count(*) AS n FROM ${quote(table)} WHERE shop_id = ?`).get(id).n])),
    messageRoles: db.prepare('SELECT role, count(*) AS count FROM messages WHERE shop_id = ? GROUP BY role ORDER BY role').all(id),
  }));
  const nonDemoUsers = db.prepare("SELECT count(*) AS n FROM users WHERE NOT ((id = 'user-coffee' AND email = 'coffee@example.test') OR (id = 'user-flower' AND email = 'flower@example.test'))").get().n;
  const nonDemoShops = db.prepare("SELECT count(*) AS n FROM shops WHERE id NOT IN ('shop-coffee', 'shop-flower')").get().n;
  return { counts, migrations: migrationChecks, missingMigrations: expected.filter(name => !migrations.some(m => m.version === name)), integrity, foreignKeyViolations, duplicateEmailGroups, timestamps, eventStatuses, shopFlows,
    dataClassification: counts.users === 0 && counts.shops === 0 ? 'empty' : nonDemoUsers || nonDemoShops ? 'contains-non-demo-records-preserve' : 'demo-identities-only-content-not-confirmed',
    valid: integrity.length === 1 && integrity[0] === 'ok' && foreignKeyViolations === 0 && duplicateEmailGroups === 0 && migrationChecks.every(m => m.matchesRepository) && Object.values(timestamps).every(columns => Object.values(columns).every(c => c.invalidIsoUtc === 0)),
  };
}

export async function backupSqlite({ source = process.env.DATABASE_PATH || './data/chatbot.sqlite', outputDir = resolve('data/backups'), migrationDir } = {}) {
  if (source === ':memory:') throw new Error('Backup requires an existing database file');
  const sourcePath = realpathSync(resolve(source)); // Missing source must fail before creating anything.
  if (!statSync(sourcePath).isFile()) throw new Error('Source must be a database file');
  const db = new DatabaseSync(sourcePath, { readOnly: true });
  let destination;
  const startedAt = new Date().toISOString();
  try {
    mkdirSync(outputDir, { recursive: true });
    // A private, unique directory prevents overwriting a previous backup or the source.
    const directory = mkdtempSync(join(resolve(outputDir), 'sqlite-'));
    destination = join(directory, 'snapshot.sqlite');
    await backup(db, destination);
  } finally {
    db.close();
  }
  const snapshot = new DatabaseSync(destination, { readOnly: true });
  let inspection;
  try { inspection = inspectSnapshot(snapshot, migrationDir); } finally { snapshot.close(); }
  const manifest = { formatVersion: 1, startedAt, completedAt: new Date().toISOString(), nodeVersion: process.version, source: sourcePath, sourceBytes: statSync(sourcePath).size, snapshot: destination, snapshotBytes: statSync(destination).size, sha256: await sha256(destination), ...inspection };
  const manifestPath = join(resolve(destination, '..'), 'manifest.json');
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  if (!inspection.valid) throw new Error(`Backup verification failed; preserved evidence: ${manifestPath}`);
  return { manifestPath, manifest };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  backupSqlite().then(({ manifestPath }) => console.log(`Verified backup manifest: ${manifestPath}`)).catch(error => {
    console.error(`SQLite backup failed: ${error.message}`);
    process.exitCode = 1;
  });
}
