import { migratePostgresql } from './postgresql/migrations.js';
import { openDatabase } from '../src/lib/db.js';
import { rebuildKnowledgeIndex } from '../src/services/rag.js';

try {
  const result = await migratePostgresql();
  console.log(`PostgreSQL migrations: applied ${result.applied.length}, unchanged ${result.skipped.length}`);
  for (const version of result.applied) console.log(version);
  const db = await openDatabase();
  try {
    const index = await rebuildKnowledgeIndex(db);
    console.log(`Knowledge index: ${index.entries} entries, ${index.chunks} chunks`);
  } finally { await db.close(); }
} catch {
  console.error('PostgreSQL migration or knowledge indexing failed. Check connection, schema, and migration history; rerun before starting the release.');
  process.exitCode = 1;
}
