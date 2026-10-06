import { getRuntimeDatabase, closeRuntimeDatabase } from '../src/lib/db.js';
import { seedDemo, demoShops, demoPassword } from '../src/lib/seed.js';
if (process.env.NODE_ENV === 'production') throw new Error('Demo seed is for local development only.');
let db;
try {
  db = await getRuntimeDatabase();
  await seedDemo(db);
  console.log('Demo seed ready (existing rows preserved).');
  for (const shop of demoShops) console.log(`${shop.id}: ${shop.email} / ${demoPassword}`);
} catch {
  console.error('Demo seed failed. Check database configuration, migrations, and demo identity conflicts.');
  process.exitCode = 1;
} finally { await closeRuntimeDatabase(); }
