import pg from 'pg';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { databaseConfig } from '../../src/lib/db.js';
import { assertSchemaReady, countToNumber, schemaName, timestampToIso } from '../../src/lib/postgresql-schema.js';
import { inspectSnapshot, sha256 } from '../backup-sqlite.js';
import { readMigrations } from '../postgresql/migrations.js';
import { indexKnowledgeEntry } from '../../src/services/rag.js';

export const tables = [
  { name: 'users', columns: ['id','email','name','password_hash','created_at'], keys: ['id'] },
  { name: 'shops', columns: ['id','name','description','opening_hours','persona','created_at','updated_at'], keys: ['id'] },
  { name: 'shop_memberships', columns: ['shop_id','user_id','role','created_at'], keys: ['shop_id','user_id'] },
  { name: 'sessions', columns: ['token_hash','user_id','expires_at','created_at'], keys: ['token_hash'] },
  { name: 'knowledge_entries', columns: ['id','shop_id','kind','title','content','status','created_by','created_at','updated_at'], keys: ['id'] },
  { name: 'conversations', columns: ['id','shop_id','channel','customer_external_id','customer_name','status','bot_mode','created_at','updated_at'], keys: ['id'] },
  { name: 'messages', columns: ['id','shop_id','conversation_id','role','content','author_user_id','created_at'], keys: ['id'] },
  { name: 'line_channels', columns: ['shop_id','channel_id','channel_secret','channel_access_token','destination_user_id','created_at','updated_at'], keys: ['shop_id'] },
  { name: 'line_events', columns: ['event_id','shop_id','event_type','reply_token','status','created_at'], keys: ['event_id'] },
  { name: 'message_sources', columns: ['shop_id','message_id','knowledge_entry_id','chunk_id','source_excerpt'], keys: ['shop_id','message_id','chunk_id'] },
];
const quote = value => `"${value.replaceAll('"', '""')}"`;
const digest = value => createHash('sha256').update(value).digest('hex');

export class TransferError extends Error {
  constructor(message, issues = []) { super(message); this.name = 'TransferError'; this.issues = issues; }
}

function sourceRows(db, table) {
  if (table.name === 'message_sources' && !db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='message_sources'").get()) return [];
  const sql = `SELECT ${table.columns.map(quote).join(',')} FROM ${quote(table.name)} ORDER BY ${table.keys.map(key => `${quote(key)} COLLATE BINARY`).join(',')}`;
  return db.prepare(sql).iterate();
}

function canonical(row, table, source = false) {
  return table.columns.map(column => {
    const value = row[column];
    const issue = reason => {
      throw new TransferError('Invalid source or target row', [{ table: table.name, keySha256: digest(JSON.stringify(table.keys.map(key => row[key]))), column, reason }]);
    };
    if (value === null) return null;
    if (column.endsWith('_at')) {
      let iso;
      try { iso = timestampToIso(value); } catch { issue('invalid_timestamp'); }
      if (source && iso !== value) issue('timestamp_not_canonical_iso_utc');
      return iso;
    }
    if (typeof value !== 'string') issue('not_text');
    if (value.includes('\0')) issue('nul_not_supported_by_postgresql');
    return value;
  });
}

function sourceStats(db) {
  return Object.fromEntries(tables.map(table => {
    const hash = createHash('sha256'); let count = 0;
    for (const row of sourceRows(db, table)) { hash.update(JSON.stringify(canonical(row, table, true)) + '\n'); count++; }
    return [table.name, { count, sha256: hash.digest('hex') }];
  }));
}

async function targetStats(client, batchSize) {
  const result = {};
  for (const table of tables) {
    const hash = createHash('sha256'); let count = 0; let last;
    for (;;) {
      const condition = last ? `WHERE (${table.keys.map(quote).join(',')}) > (${table.keys.map((_,i) => `$${i + 1}`).join(',')})` : '';
      const params = last ? [...last, batchSize] : [batchSize];
      const { rows } = await client.query(`SELECT ${table.columns.map(quote).join(',')} FROM ${quote(table.name)} ${condition} ORDER BY ${table.keys.map(key => `${quote(key)} COLLATE "C"`).join(',')} LIMIT $${params.length}`, params);
      if (!rows.length) break;
      for (const row of rows) { hash.update(JSON.stringify(canonical(row, table)) + '\n'); count++; }
      last = table.keys.map(key => rows.at(-1)[key]);
    }
    result[table.name] = { count, sha256: hash.digest('hex') };
  }
  return result;
}

function assertNoWal(path) {
  if (existsSync(`${path}-wal`) && statSync(`${path}-wal`).size > 0) throw new TransferError('Source has WAL data; use a completed SQLite backup snapshot');
}

async function openSource(path) {
  if (!path || path === ':memory:') throw new TransferError('SQLITE_SOURCE_PATH must name an existing backup snapshot');
  let source;
  try { source = realpathSync(resolve(path)); } catch { throw new TransferError('SQLite source does not exist'); }
  if (!statSync(source).isFile()) throw new TransferError('SQLite source is not a file');
  const live = resolve(process.env.DATABASE_PATH || './data/chatbot.sqlite');
  if (existsSync(live) && realpathSync(live) === source) throw new TransferError('Live SQLite source is not allowed; use db:backup:sqlite first');
  assertNoWal(source);
  let receipt;
  try { receipt = JSON.parse(readFileSync(join(source, '..', 'manifest.json'), 'utf8')); }
  catch { throw new TransferError('Backup manifest.json is required beside the SQLite snapshot'); }
  const checksum = await sha256(source);
  if (receipt.formatVersion !== 1 || receipt.valid !== true || receipt.sha256 !== checksum) throw new TransferError('SQLite snapshot checksum or backup manifest is invalid');
  const db = new DatabaseSync(source, { readOnly: true });
  try {
    db.exec('BEGIN');
    for (const table of tables) {
      const columns = db.prepare(`PRAGMA table_info(${quote(table.name)})`).all().map(column => column.name);
      if (table.name === 'message_sources' && !columns.length) continue;
      if (JSON.stringify(columns) !== JSON.stringify(table.columns)) throw new TransferError(`Unexpected SQLite columns: ${table.name}`);
    }
    // Scan field values first so invalid rows can be identified without logging secrets.
    const stats = sourceStats(db);
    const inspection = inspectSnapshot(db);
    if (inspection.foreignKeyViolations) {
      const issues = db.prepare('PRAGMA foreign_key_check').all().map(violation => {
        const table = tables.find(table => table.name === violation.table);
        const row = table ? db.prepare(`SELECT ${table.keys.map(quote).join(',')} FROM ${quote(table.name)} WHERE rowid=?`).get(violation.rowid) : null;
        return { table: table?.name || 'unknown', keySha256: digest(JSON.stringify(row ? table.keys.map(key => row[key]) : [violation.rowid])), reason: 'foreign_key_violation' };
      });
      throw new TransferError('SQLite foreign key violations were found', issues);
    }
    const versions = inspection.migrations.map(row => row.version);
    if (!inspection.valid || inspection.missingMigrations.some(version => version !== '004_rag.sql') || ![3,4].includes(versions.length) || versions.some((version,index) => version.slice(0,3) !== String(index+1).padStart(3,'0'))) throw new TransferError('SQLite integrity, foreign keys, timestamps, or baseline migrations are invalid');
    const ownerless = db.prepare("SELECT count(*) AS count FROM shops s WHERE NOT EXISTS (SELECT 1 FROM shop_memberships m WHERE m.shop_id=s.id AND m.role='owner')").get().count;
    if (ownerless) throw new TransferError('SQLite shops without an owner membership were found', db.prepare("SELECT id FROM shops s WHERE NOT EXISTS (SELECT 1 FROM shop_memberships m WHERE m.shop_id=s.id AND m.role='owner')").all().map(row => ({ table: 'shops', keySha256: digest(JSON.stringify([row.id])), reason: 'owner_membership_missing' })));
    return { db, path: source, sha256: checksum, stats, migrations: inspection.migrations, samples: inspection.shopFlows.map(row => ({ sample: row.sample, counts: row.counts })), unresolved: inspection.eventStatuses.filter(row => ['received','processing'].includes(row.status)).map(row => ({ ...row })) };
  } catch (error) { db.close(); throw error; }
}

async function assertSourceUnchanged(source) {
  assertNoWal(source.path);
  if (await sha256(source.path) !== source.sha256) throw new TransferError('SQLite snapshot changed during transfer');
}

async function checkTarget(client, requireEmpty) {
  await assertSchemaReady(client);
  const expected = await readMigrations();
  const migrations = (await client.query('SELECT version,checksum,applied_at FROM schema_migrations ORDER BY version')).rows;
  if (migrations.length !== expected.length || migrations.some((row,i) => row.version !== expected[i].version || row.checksum !== expected[i].checksum)) throw new TransferError('Target PostgreSQL migration checksums do not match this repository');
  const counts = {};
  for (const table of [...tables.map(table => table.name), 'line_jobs', 'knowledge_chunks']) {
    counts[table] = countToNumber((await client.query(`SELECT count(*) AS count FROM ${quote(table)}`)).rows[0].count);
  }
  if (requireEmpty && Object.values(counts).some(count => count !== 0)) throw new TransferError('Target must have empty business tables and line_jobs; no force/reset/upsert is supported');
  return { counts, migrations };
}

async function checkEmails(source, client, batchSize) {
  const seen = new Set(); let batch = [];
  async function check() {
    const result = await client.query('SELECT lower(value) AS email FROM unnest($1::text[]) AS value', [batch.map(row => row.email)]);
    for (const [index, row] of result.rows.entries()) {
      if (seen.has(row.email)) throw new TransferError('Email collision under PostgreSQL lower(email)', [{ table: 'users', keySha256: digest(JSON.stringify([batch[index].id])), reason: 'duplicate_email' }]);
      seen.add(row.email);
    }
    batch = [];
  }
  for (const row of sourceRows(source.db, tables[0])) { batch.push(row); if (batch.length >= batchSize) await check(); }
  if (batch.length) await check();
}

async function insertTable(source, client, table, batchSize) {
  let batch = [];
  async function insert() {
    const params = []; const values = batch.map(row => `(${canonical(row, table, true).map(value => { params.push(value); return `$${params.length}`; }).join(',')})`);
    try { await client.query(`INSERT INTO ${quote(table.name)} (${table.columns.map(quote).join(',')}) VALUES ${values.join(',')}`, params); }
    catch { throw new TransferError(`Import failed in table ${table.name}; transaction will roll back`, batch.map(row => ({ table: table.name, keySha256: digest(JSON.stringify(table.keys.map(key => row[key]))) }))); }
    batch = [];
  }
  for (const row of sourceRows(source.db, table)) { batch.push(row); if (batch.length >= batchSize) await insert(); }
  if (batch.length) await insert();
}

const references = [
  ['shop_memberships','shops',['shop_id'],['id']], ['shop_memberships','users',['user_id'],['id']],
  ['sessions','users',['user_id'],['id']], ['knowledge_entries','shops',['shop_id'],['id']],
  ['knowledge_entries','shop_memberships',['shop_id','created_by'],['shop_id','user_id']],
  ['conversations','shops',['shop_id'],['id']], ['messages','shops',['shop_id'],['id']],
  ['messages','conversations',['shop_id','conversation_id'],['shop_id','id']],
  ['messages','shop_memberships',['shop_id','author_user_id'],['shop_id','user_id']],
  ['line_channels','shops',['shop_id'],['id']], ['line_events','shops',['shop_id'],['id']],
  ['message_sources','messages',['shop_id','message_id'],['shop_id','id']],
];

async function verifyRelationships(client) {
  for (const [child,parent,local,remote] of references) {
    const joined = local.map((key,i) => `c.${quote(key)}=p.${quote(remote[i])}`).join(' AND ');
    const present = local.map(key => `c.${quote(key)} IS NOT NULL`).join(' AND ');
    const result = await client.query(`SELECT count(*) AS count FROM ${quote(child)} c LEFT JOIN ${quote(parent)} p ON ${joined} WHERE ${present} AND p.${quote(remote[0])} IS NULL`);
    if (result.rows[0].count !== '0') throw new TransferError(`Orphan or tenant reference found in ${child}`);
  }
  if ((await client.query("SELECT count(*) AS count FROM shops s WHERE NOT EXISTS (SELECT 1 FROM shop_memberships m WHERE m.shop_id=s.id AND m.role='owner')")).rows[0].count !== '0') throw new TransferError('Target shops without owner membership were found');
}

async function shopSamples(client) {
  const shops = (await client.query('SELECT id FROM shops ORDER BY id COLLATE "C" LIMIT 2')).rows;
  const samples = [];
  for (const [index, shop] of shops.entries()) {
    const counts = {};
    for (const table of ['shop_memberships','knowledge_entries','conversations','messages','line_channels','line_events']) counts[table] = countToNumber((await client.query(`SELECT count(*) AS count FROM ${table} WHERE shop_id=$1`, [shop.id])).rows[0].count);
    const text = (await client.query('SELECT max(length(content)) AS longest, count(*) FILTER (WHERE author_user_id IS NULL) AS nullAuthors FROM messages WHERE shop_id=$1', [shop.id])).rows[0];
    samples.push({ sample: index + 1, counts, longestMessageCharacters: text.longest, nullAuthors: countToNumber(text.nullauthors) });
  }
  return samples;
}

export async function transferSqlite({ sourcePath = process.env.SQLITE_SOURCE_PATH, config = {}, mode = 'dry-run', batchSize = Number(process.env.SQLITE_IMPORT_BATCH_SIZE ?? 200), outputDir = resolve('data/import-reports'), importQueryTimeoutMs = Number(process.env.DB_IMPORT_QUERY_TIMEOUT_MS ?? 60000) } = {}) {
  if (!['dry-run','import','verify'].includes(mode)) throw new TransferError('Invalid transfer mode');
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 1000) throw new TransferError('Batch size must be an integer from 1 to 1000');
  if (!Number.isSafeInteger(importQueryTimeoutMs) || importQueryTimeoutMs < 1) throw new TransferError('Import query timeout must be a positive integer');
  const schema = schemaName(config.schema ?? process.env.DB_SCHEMA ?? 'public');
  const pgConfig = databaseConfig({ ...config, schema, queryTimeoutMs: importQueryTimeoutMs });
  const targetUrl = new URL(pgConfig.connectionString);
  mkdirSync(outputDir, { recursive: true });
  const manifestPath = join(mkdtempSync(join(resolve(outputDir), 'sqlite-transfer-')), 'manifest.json');
  const manifest = { formatVersion: 1, mode, startedAt: new Date().toISOString(), target: { hostname: targetUrl.hostname, port: targetUrl.port || '5432', database: decodeURIComponent(targetUrl.pathname.slice(1)), schema }, batchSize, importQueryTimeoutMs, status: 'running', transactionState: 'not-started' };
  const save = () => writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });
  save();
  let source; let begun = false; let commitAttempted = false; let committed = false;
  const client = new pg.Client(pgConfig); client.on('error', () => {});
  try {
    source = await openSource(sourcePath);
    manifest.source = { path: source.path, sha256: source.sha256, tables: source.stats, migrations: source.migrations, shopSamples: source.samples };
    manifest.unresolvedLineHistory = { counts: source.unresolved, policy: 'Preserved as history; no jobs created or old LINE replies sent' };
    await client.connect();
    await client.query(mode === 'import' ? 'BEGIN' : 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); begun = true;
    if (mode === 'import') {
      await client.query('SELECT pg_advisory_xact_lock(1936548461,hashtext($1))', [schema]);
      await assertSchemaReady(client);
      await client.query(`LOCK TABLE ${[...tables.map(table => table.name),'line_jobs','knowledge_chunks'].map(table => `${quote(schema)}.${quote(table)}`).join(',')} IN SHARE ROW EXCLUSIVE MODE`);
    }
    const target = await checkTarget(client, mode !== 'verify');
    manifest.targetMigrations = target.migrations;
    manifest.targetCountsBefore = target.counts;
    await checkEmails(source, client, batchSize);
    if (mode === 'import') for (const table of tables) await insertTable(source, client, table, batchSize);
    if (mode === 'import') {
      const entries = (await client.query("SELECT shop_id,id FROM knowledge_entries WHERE status='published' ORDER BY shop_id,id")).rows;
      for (const entry of entries) await indexKnowledgeEntry(client,entry.shop_id,entry.id);
    }
    if (mode !== 'dry-run') {
      const stats = await targetStats(client, batchSize);
      manifest.targetTables = stats;
      manifest.verification = Object.fromEntries(tables.map(table => [table.name, { match: stats[table.name].count === source.stats[table.name].count && stats[table.name].sha256 === source.stats[table.name].sha256 }]));
      if (Object.values(manifest.verification).some(value => !value.match)) throw new TransferError('Source and target counts/checksums differ');
      await verifyRelationships(client);
      manifest.shopSamples = await shopSamples(client);
      if (JSON.stringify(manifest.shopSamples.map(row => ({ sample: row.sample, counts: row.counts }))) !== JSON.stringify(source.samples)) throw new TransferError('Two-shop relationship samples differ');
      manifest.lineJobsCount = countToNumber((await client.query('SELECT count(*) AS count FROM line_jobs')).rows[0].count);
      if (mode === 'import' && manifest.lineJobsCount !== 0) throw new TransferError('Import unexpectedly created LINE jobs');
    }
    await assertSourceUnchanged(source);
    manifest.transactionState = mode === 'import' ? 'verified-before-commit' : 'read-only'; save();
    commitAttempted = true; await client.query('COMMIT'); begun = false; committed = true;
    manifest.status = 'passed'; manifest.transactionState = mode === 'import' ? 'committed' : 'read-only';
    manifest.completedAt = new Date().toISOString(); save();
    return { manifestPath, manifest };
  } catch (error) {
    if (begun) await client.query('ROLLBACK').catch(() => {});
    manifest.status = 'failed';
    manifest.transactionState = committed ? 'committed-report-failed' : commitAttempted && mode === 'import' ? 'commit-uncertain' : begun ? 'rolled-back' : 'not-started';
    manifest.error = error instanceof TransferError ? { message: error.message, issues: error.issues } : { message: 'Transfer failed; check source schema, target connectivity, and migration readiness' };
    manifest.completedAt = new Date().toISOString(); try { save(); } catch { /* Preserve earlier receipt when final report cannot be written. */ }
    const safe = new TransferError(`${manifest.error.message}; manifest: ${manifestPath}`, manifest.error.issues);
    safe.manifestPath = manifestPath; throw safe;
  } finally {
    source?.db.close();
    await client.end().catch(() => {});
  }
}
