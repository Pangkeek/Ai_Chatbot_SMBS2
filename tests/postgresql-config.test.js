import { test } from 'node:test';
import assert from 'node:assert/strict';
import { databaseConfig } from '../src/lib/db.js';

test('PostgreSQL config fails closed and never falls back to SQLite or URL TLS overrides', () => {
  assert.throws(() => databaseConfig({}, {}), /DATABASE_URL is required/);
  const connectionString = 'postgresql://user:secret@127.0.0.1:55432/chatbot_test';
  assert.deepEqual(databaseConfig({ connectionString }, {}).ssl, { rejectUnauthorized: true });
  assert.equal(databaseConfig({ connectionString, sslMode: 'disable' }, {}).ssl, false);
  assert.deepEqual(databaseConfig({ connectionString, sslMode: 'require' }, {}).ssl, { rejectUnauthorized: false });
  for (const suffix of ['?sslmode=disable', '?sslrootcert=secret', '?options=unsafe']) assert.throws(() => databaseConfig({ connectionString: connectionString + suffix }, {}), /query parameters/);
  assert.throws(() => databaseConfig({ connectionString: connectionString.replace('127.0.0.1', 'remote.example'), sslMode: 'disable' }, {}), /loopback/);
  for (const max of [0, -1, 'invalid', 1.5, '']) assert.throws(() => databaseConfig({ connectionString, max }, {}), /positive integer/);
  assert.throws(() => databaseConfig({ connectionString: 'sqlite:foo' }, {}), /PostgreSQL host/);
});
