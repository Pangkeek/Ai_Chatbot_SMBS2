import { openDatabase } from '../src/db.mjs';
import { seedDemo, demoShops, demoPassword } from '../src/seed.mjs';
if (process.env.NODE_ENV === 'production') throw new Error('Demo seed is for local development only.');
const db = openDatabase();
try {
  await seedDemo(db);
  console.log('Demo seed ready (existing rows preserved).');
  for (const shop of demoShops) console.log(`${shop.id}: ${shop.email} / ${demoPassword}`);
} finally { db.close(); }
