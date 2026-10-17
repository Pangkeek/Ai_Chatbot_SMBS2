export const requiredMigrations = ['001_initial.sql', '002_line_jobs.sql', '003_defer_job_checkpoint_references.sql', '004_rag.sql', '005_handover.sql'];
export const requiredTables = ['schema_migrations', 'users', 'shops', 'shop_memberships', 'sessions', 'knowledge_entries', 'conversations', 'messages', 'line_channels', 'line_events', 'line_jobs', 'knowledge_chunks', 'message_sources', 'agent_deliveries'];

export function schemaName(value = 'public') {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(value) || value.startsWith('pg_') || value === 'information_schema') throw new Error('Invalid PostgreSQL application schema');
  return value;
}

// Read-only startup gate: migrations are an explicit deployment step, never an API side effect.
export async function assertSchemaReady(db) {
  const { rows } = await db.query(`SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = current_schema()`);
  const found = new Set(rows.map(row => row.tablename));
  if (requiredTables.some(table => !found.has(table))) throw new Error('PostgreSQL schema is not ready; run npm run db:migrate:postgres');
  const applied = await db.query('SELECT version FROM schema_migrations');
  if (requiredMigrations.some(version => !applied.rows.some(row => row.version === version))) throw new Error('PostgreSQL migrations are incomplete; run npm run db:migrate:postgres');
}

// Convert only pagination counts; leave arbitrary int8 values as strings to avoid precision loss.
export function countToNumber(value) {
  if (!['string', 'number', 'bigint'].includes(typeof value) || !/^\d+$/.test(String(value))) throw new Error('Invalid database count');
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error('Database count exceeds the safe integer range');
  return number;
}

export function timestampToIso(value) {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (typeof value !== 'string' && !(value instanceof Date) || !Number.isFinite(date.getTime())) throw new Error('Invalid database timestamp');
  return date.toISOString();
}

export function serializeDates(value) {
  if (value instanceof Date) return timestampToIso(value);
  if (Array.isArray(value)) return value.map(serializeDates);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeDates(item)]));
  return value;
}
