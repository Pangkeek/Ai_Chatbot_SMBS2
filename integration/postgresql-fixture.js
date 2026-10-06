import { randomUUID } from 'node:crypto';
import { openDatabase } from '../src/lib/db.js';

export function testConfig() {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error('TEST_DATABASE_URL is required; PostgreSQL tests do not skip');
  const target = new URL(connectionString);
  if (target.pathname !== '/chatbot_test' || !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)) throw new Error('Tests require a loopback chatbot_test database');
  if (process.env.DATABASE_URL) {
    const runtime = new URL(process.env.DATABASE_URL);
    if (runtime.port === target.port && runtime.pathname === target.pathname) throw new Error('Test and runtime databases must differ');
  }
  return { connectionString, sslMode: 'disable', schema: 'public' };
}

export async function withTestSchema(action) {
  const fixture = await createTestDatabase();
  try { return await action(fixture); } finally { await fixture.dispose(); }
}

export async function createTestDatabase() {
  const config = testConfig();
  const admin = await openDatabase(config);
  const schema = `test_${randomUUID().replaceAll('-', '')}`;
  let db;
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    config.schema = schema;
    db = await openDatabase(config);
    return { db, config, schema, async dispose() {
      await db.close();
      try { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); } finally { await admin.close(); }
    } };
  } catch (error) {
    await db?.close();
    try { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); } finally { await admin.close(); }
    throw error;
  }
}
