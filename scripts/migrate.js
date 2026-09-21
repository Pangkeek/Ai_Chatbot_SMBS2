import { openDatabase } from '../src/lib/db.js';
const db = openDatabase();
console.log(db.prepare('SELECT version, applied_at FROM schema_migrations ORDER BY version').all());
db.close();
