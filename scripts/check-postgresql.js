import { openDatabase } from '../src/lib/db.js';

let db;
try {
  db = await openDatabase();
  const { rows } = await db.query('SHOW server_version');
  console.log(`PostgreSQL connection OK (${rows[0].server_version})`);
} catch {
  console.error('PostgreSQL check failed. Check DATABASE_URL, DB_SSL_MODE, and server availability.');
  process.exitCode = 1;
} finally {
  await db?.close();
}
