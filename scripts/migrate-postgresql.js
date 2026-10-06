import { migratePostgresql } from './postgresql/migrations.js';

try {
  const result = await migratePostgresql();
  console.log(`PostgreSQL migrations: applied ${result.applied.length}, unchanged ${result.skipped.length}`);
  for (const version of result.applied) console.log(version);
} catch {
  console.error('PostgreSQL migration failed. Check connection, schema, migration history, and SQL; no failed migration was committed.');
  process.exitCode = 1;
}
