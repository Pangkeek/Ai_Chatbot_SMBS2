import { openDatabase } from '../src/lib/db.js';
import { assertSchemaReady } from '../src/lib/postgresql-schema.js';
import { cleanupLineHistory } from '../src/services/lineRetention.js';
let db;
try {
  if (process.argv.length > 2) throw new Error('Unexpected arguments');
  db = await openDatabase(); await assertSchemaReady(db);
  const result = await cleanupLineHistory(db);
  console.log(`LINE retention: cleared ${result.jobs} job payloads and ${result.events} event reply tokens; deduplication IDs retained`);
} catch { console.error('LINE cleanup failed; check database configuration and schema'); process.exitCode = 1; }
finally { await db?.close(); }
