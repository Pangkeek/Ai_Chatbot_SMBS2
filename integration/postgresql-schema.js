import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migratePostgresql } from '../scripts/postgresql/migrations.js';
import { assertSchemaReady, countToNumber, timestampToIso, requiredTables, requiredMigrations } from '../src/lib/postgresql-schema.js';
import { withTestSchema } from './postgresql-fixture.js';

test('fresh/concurrent/rerun migrations, checksum preflight, failed SQL atomicity and lock release', async () => withTestSchema(async ({ db, config }) => {
  await assert.rejects(assertSchemaReady(db), /schema is not ready/);
  const runs = await Promise.all([migratePostgresql({ config }), migratePostgresql({ config })]);
  assert.deepEqual(runs.map(r => r.applied.length).sort(), [0, requiredMigrations.length]);
  await assertSchemaReady(db);
  const before = (await db.query('SELECT * FROM schema_migrations ORDER BY version')).rows;
  assert.equal(before.length, requiredMigrations.length);
  await migratePostgresql({ config });
  assert.deepEqual((await db.query('SELECT * FROM schema_migrations ORDER BY version')).rows, before);
  const dir = await mkdtemp(join(tmpdir(), 'postgres-migrations-'));
  try {
    await cp(new URL('../migrations/postgresql/', import.meta.url), dir, { recursive: true });
    const first = join(dir, '001_initial.sql');
    const sql = await readFile(first, 'utf8');
    await writeFile(first, sql.replaceAll('\n', '\r\n'));
    assert.equal((await migratePostgresql({ config, directory: dir })).applied.length, 0);
    await writeFile(first, sql + '\n-- changed\n');
    await writeFile(join(dir, '006_probe.sql'), 'CREATE TABLE probe(id integer);');
    await assert.rejects(migratePostgresql({ config, directory: dir }), /Applied migration changed/);
    assert.equal((await db.query("SELECT to_regclass('probe') AS value")).rows[0].value, null);
    await writeFile(first, sql);
    await writeFile(join(dir, '006_probe.sql'), 'CREATE TABLE probe(id integer); INSERT INTO probe VALUES (1); SELECT missing_column FROM probe;');
    await assert.rejects(migratePostgresql({ config, directory: dir }), /migration failed: 006/);
    assert.equal((await db.query("SELECT to_regclass('probe') AS value")).rows[0].value, null);
    assert.deepEqual((await db.query('SELECT * FROM schema_migrations ORDER BY version')).rows, before);
    // Retry acquires the lock after failure, and commits exactly once.
    await writeFile(join(dir, '006_probe.sql'), 'CREATE TABLE probe(id integer);');
    assert.deepEqual((await migratePostgresql({ config, directory: dir })).applied, ['006_probe.sql']);
    // Failure while recording the migration must roll back its DDL as well.
    await db.query(`CREATE FUNCTION reject_migration_record() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.version = '007_record_failure.sql' THEN RAISE EXCEPTION 'fixture record failure'; END IF; RETURN NEW; END $$`);
    await db.query('CREATE TRIGGER reject_record BEFORE INSERT ON schema_migrations FOR EACH ROW EXECUTE FUNCTION reject_migration_record()');
    await writeFile(join(dir, '007_record_failure.sql'), 'CREATE TABLE record_probe(id integer);');
    await assert.rejects(migratePostgresql({ config, directory: dir }), /migration failed: 007/);
    assert.equal((await db.query("SELECT to_regclass('record_probe') AS value")).rows[0].value, null);
    assert.equal((await db.query("SELECT * FROM schema_migrations WHERE version = '007_record_failure.sql'")).rowCount, 0);
    await db.query('DROP TRIGGER reject_record ON schema_migrations');
    assert.equal((await db.query("SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND classid = 1936548461 AND objid::bigint = (hashtext($1)::bigint & 4294967295) AND database = (SELECT oid FROM pg_database WHERE datname = current_database())", [config.schema])).rows[0].count, '0');
  } finally { await rm(dir, { recursive: true, force: true }); }
}));

const time = '2026-10-06T00:00:00.123Z';
async function seed(db) {
  for (const suffix of ['a', 'b']) {
    await db.query('INSERT INTO users VALUES ($1,$2,$3,$4,$5)', [`u-${suffix}`, `${suffix}@example.test`, 'ชื่อไทย', 'opaque-hash', time]);
    await db.query('INSERT INTO shops(id,name,created_at,updated_at) VALUES ($1,$2,$3,$3)', [`s-${suffix}`, 'ร้านไทย', time]);
    await db.query('INSERT INTO shop_memberships VALUES ($1,$2,$3,$4)', [`s-${suffix}`, `u-${suffix}`, 'owner', time]);
    await db.query('INSERT INTO knowledge_entries VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)', [`k-${suffix}`, `s-${suffix}`, 'faq', 'หัวข้อ', 'คำตอบ', 'published', `u-${suffix}`, time]);
    await db.query('INSERT INTO conversations VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)', [`c-${suffix}`, `s-${suffix}`, 'line', 'same-customer', 'ลูกค้า', 'open', 'active', time]);
    await db.query('INSERT INTO messages VALUES ($1,$2,$3,$4,$5,$6,$7)', [`m-${suffix}`, `s-${suffix}`, `c-${suffix}`, 'customer', 'สวัสดี', null, time]);
    await db.query('INSERT INTO line_channels VALUES ($1,NULL,$2,$3,NULL,$4,$4)', [`s-${suffix}`, 'fixture-secret', 'fixture-token', time]);
    await db.query('INSERT INTO line_events VALUES ($1,$2,$3,NULL,$4,$5)', [`e-${suffix}`, `s-${suffix}`, 'message', 'received', time]);
    await db.query('INSERT INTO line_jobs(job_id,shop_id,event_id,payload) VALUES ($1,$2,$3,$4)', [`j-${suffix}`, `s-${suffix}`, `e-${suffix}`, { type: 'message' }]);
    await db.query('INSERT INTO knowledge_chunks VALUES ($1,$2,$3,0,$4,$5,$6,$7)', [`chunk-${suffix}`,`s-${suffix}`,`k-${suffix}`,'คำตอบ','[]','fixture',time]);
    await db.query('INSERT INTO message_sources VALUES ($1,$2,$3,$4,$5)', [`s-${suffix}`,`m-${suffix}`,`k-${suffix}`,`chunk-${suffix}`,'คำตอบ']);
  }
  await db.query('INSERT INTO sessions VALUES ($1,$2,$3,$3)', ['a'.repeat(64), 'u-a', time]);
}

test('business constraints reject invalid data, case-insensitive duplicate users, and tenant crossover', async () => withTestSchema(async ({ db, config }) => {
  await migratePostgresql({ config });
  await seed(db);
  const bad = async (sql, params, code = '23514') => assert.rejects(db.query(sql, params), { code });
  // Every business CHECK category from the final SQLite schema, including length boundaries.
  const checks = {
    users: { id: ['', ' x ', 'x'.repeat(101)], email: ['ab', ' a@b', 'x'.repeat(255)], name: [' ', 'x'.repeat(101)], password_hash: ['', 'x'.repeat(256)] },
    shops: { id: ['', ' x ', 'x'.repeat(101)], name: [' ', 'x'.repeat(121)], description: ['x'.repeat(5001)], opening_hours: ['x'.repeat(1001)], persona: ['x'.repeat(5001)] },
    shop_memberships: { shop_id: ['', 'x'.repeat(101)], user_id: ['', 'x'.repeat(101)], role: ['admin'] },
    sessions: { token_hash: ['A'.repeat(64), 'g'.repeat(64), 'a'.repeat(63), 'a'.repeat(65)], user_id: ['', 'x'.repeat(101)] },
    knowledge_entries: { id: ['', ' x ', 'x'.repeat(101)], shop_id: ['', 'x'.repeat(101)], kind: ['unknown'], title: [' ', 'x'.repeat(201)], content: [' ', 'x'.repeat(20001)], status: ['unknown'], created_by: ['', 'x'.repeat(101)] },
    conversations: { id: ['', ' x ', 'x'.repeat(101)], shop_id: ['', 'x'.repeat(101)], channel: ['email'], customer_external_id: [' ', 'x'.repeat(201)], customer_name: [' ', 'x'.repeat(101)], status: ['unknown'], bot_mode: ['unknown'] },
    messages: { id: ['', ' x ', 'x'.repeat(101)], shop_id: ['', 'x'.repeat(101)], conversation_id: ['', 'x'.repeat(101)], role: ['unknown', 'agent'], content: [' ', 'x'.repeat(10001)], author_user_id: ['', 'x'.repeat(101), 'u-a'] },
    line_channels: { channel_secret: [' ', 'x'.repeat(101)], channel_access_token: [' ', 'x'.repeat(501)] },
    line_events: { event_type: [' ', 'x'.repeat(51)], status: ['unknown'] },
    line_jobs: { job_id: ['', ' x ', 'x'.repeat(101)], status: ['unknown-state'], attempts: [-1], delivery_state: ['invalid'], payload: [JSON.stringify([])], locked_by: [' '], reply_text: [' ', 'x'.repeat(10001)], last_error_code: [' ', 'x'.repeat(101)], customer_message_id: ['m-a'] },
  };
  for (const [table, columns] of Object.entries(checks)) {
    for (const [column, values] of Object.entries(columns)) {
      for (const value of values) await bad(`UPDATE ${table} SET ${column} = $1`, [value]);
    }
  }
  const columns = await db.query('SELECT table_name,column_name,is_nullable,data_type FROM information_schema.columns WHERE table_schema = current_schema()');
  for (const column of columns.rows.filter(c => c.table_name !== 'schema_migrations')) {
    if (column.is_nullable === 'NO') await bad(`UPDATE ${column.table_name} SET ${column.column_name} = NULL`, [], '23502');
    if (column.data_type === 'timestamp with time zone') await bad(`UPDATE ${column.table_name} SET ${column.column_name} = 'infinity'`, []);
  }
  await bad("UPDATE users SET email = 'A@EXAMPLE.TEST' WHERE id = 'u-b'", [], '23505');
  const competing = await Promise.allSettled(['RACE@example.test', 'race@example.test'].map((email, index) => db.query('INSERT INTO users VALUES ($1,$2,$3,$4,$5)', [`race-${index}`, email, 'Concurrent user', 'hash', time])));
  assert.equal(competing.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(competing.find(r => r.status === 'rejected').reason.code, '23505');
  await bad("UPDATE sessions SET user_id = 'missing'", [], '23503');
  await bad("UPDATE shop_memberships SET user_id = 'missing'", [], '23503');
  await bad("UPDATE shop_memberships SET shop_id = 'missing'", [], '23503');
  await bad("UPDATE knowledge_entries SET created_by = 'u-b' WHERE id = 'k-a'", [], '23503');
  await bad("UPDATE knowledge_entries SET shop_id = 'missing'", [], '23503');
  await bad("UPDATE conversations SET shop_id = 'missing'", [], '23503');
  await bad("UPDATE messages SET shop_id = 's-b' WHERE id = 'm-a'", [], '23503');
  await bad("UPDATE messages SET role = 'agent', author_user_id = 'u-b' WHERE id = 'm-a'", [], '23503');
  await bad("UPDATE messages SET shop_id = 'missing'", [], '23503');
  await bad("UPDATE line_channels SET shop_id = 'missing' WHERE shop_id = 's-a'", [], '23503');
  await bad("UPDATE line_events SET shop_id = 'missing'", [], '23503');
  await bad("UPDATE line_jobs SET shop_id = 's-b' WHERE job_id = 'j-a'", [], '23503');
  await bad("UPDATE line_jobs SET conversation_id = 'c-b' WHERE job_id = 'j-a'", [], '23503');
  await bad("UPDATE line_jobs SET conversation_id = 'c-a', customer_message_id = 'm-b' WHERE job_id = 'j-a'", [], '23503');
  await bad("UPDATE line_jobs SET conversation_id = 'c-a', reply_message_id = 'm-b' WHERE job_id = 'j-a'", [], '23503');
  await bad("INSERT INTO line_jobs(job_id,shop_id,event_id,payload) VALUES ('duplicate','s-a','e-a','{}')", [], '23505');
  await bad("INSERT INTO line_events VALUES ('e-a','s-b','message',NULL,'received',now())", [], '23505');
  // Positive controls: valid agent author and a complete same-tenant checkpoint/lease.
  await db.query("UPDATE messages SET role='agent', author_user_id='u-a' WHERE id='m-a'");
  await db.query("UPDATE line_jobs SET conversation_id='c-a', customer_message_id='m-a', locked_at=now(), lease_until=now()+interval '1 minute', locked_by='worker' WHERE job_id='j-a'");
  await bad("UPDATE line_jobs SET lease_until = locked_at WHERE job_id='j-a'", []);
  await bad("UPDATE line_jobs SET locked_by=NULL WHERE job_id='j-a'", []);
}));

test('delete semantics, ID collation, timestamp/count serialization and no open-conversation uniqueness', async () => withTestSchema(async ({ db, config }) => {
  await migratePostgresql({ config });
  await seed(db);
  await assert.rejects(db.query("DELETE FROM users WHERE id='u-a'"), { code: '23001' });
  await assert.rejects(db.query("DELETE FROM shop_memberships WHERE shop_id='s-a'"), { code: '23503' });
  const row = (await db.query("SELECT created_at, count(*) OVER () AS total FROM messages WHERE id='m-a'")).rows[0];
  assert.equal(timestampToIso(row.created_at), time);
  assert.equal(JSON.parse(JSON.stringify(row)).created_at, time);
  assert.equal(countToNumber(row.total), 1);
  assert.throws(() => countToNumber('9007199254740992'), /safe integer/);
  const collation = await db.query("SELECT collation_name FROM information_schema.columns WHERE table_schema=current_schema() AND column_name='id'");
  assert.ok(collation.rows.every(row => row.collation_name === 'C'));
  for (const id of ['z', 'Z', 'a']) await db.query("INSERT INTO conversations SELECT $1, shop_id, channel, customer_external_id, customer_name, status, bot_mode, created_at, updated_at FROM conversations WHERE id='c-a'", [id]);
  assert.deepEqual((await db.query("SELECT id FROM conversations WHERE id IN ('z','Z','a') ORDER BY created_at,id")).rows.map(row => row.id), ['Z', 'a', 'z']);
  await db.query("DELETE FROM conversations WHERE id='c-b'");
  assert.equal((await db.query("SELECT * FROM messages WHERE id='m-b'")).rowCount, 0);
  await db.query("DELETE FROM line_events WHERE event_id='e-b'");
  assert.equal((await db.query("SELECT * FROM line_jobs WHERE job_id='j-b'")).rowCount, 0);
  await db.query("UPDATE line_jobs SET conversation_id='c-a', customer_message_id='m-a' WHERE job_id='j-a'");
  await db.query("DELETE FROM shops WHERE id='s-a'");
  for (const table of requiredTables.filter(t => !['schema_migrations','users','shops','sessions'].includes(t))) assert.equal((await db.query(`SELECT * FROM ${table} WHERE shop_id='s-a'`)).rowCount, 0);
  await db.query("DELETE FROM users WHERE id='u-a'");
  assert.equal((await db.query('SELECT * FROM sessions')).rowCount, 0);
  await db.query('DROP TABLE line_jobs');
  await assert.rejects(assertSchemaReady(db), /schema is not ready/);
}));
