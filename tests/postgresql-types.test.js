import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countToNumber, timestampToIso, schemaName } from '../src/lib/postgresql-schema.js';

test('PostgreSQL boundary conversions preserve ISO UTC, nulls, and safe count numbers', () => {
  assert.equal(timestampToIso(new Date('2026-10-06T07:00:00+07:00')), '2026-10-06T00:00:00.000Z');
  assert.equal(timestampToIso(null), null);
  for (const value of [undefined, false, 123, 'infinity', new Date(NaN)]) assert.throws(() => timestampToIso(value), /Invalid/);
  for (const value of ['0', 3, 4n, '9007199254740991']) assert.equal(countToNumber(value), Number(value));
  for (const value of [null, '', false, -1, 1.5, '1e2', '9007199254740992']) assert.throws(() => countToNumber(value));
  for (const value of ['public,other', 'pg_catalog', 'information_schema', 'x;DROP SCHEMA public', 'x'.repeat(64)]) assert.throws(() => schemaName(value));
});
