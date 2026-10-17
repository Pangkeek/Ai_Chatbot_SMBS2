import { openDatabase } from '../../src/lib/db.js';
import { createLineWorker } from '../../src/services/worker.js';
const db = await openDatabase({ connectionString: process.env.TEST_DATABASE_URL, schema: process.env.DB_SCHEMA, sslMode: 'disable' });
const hold = async stage => { process.send({ stage }); await new Promise(() => {}); };
const worker = createLineWorker(db, { logErrors: false,
  generateReply: async () => { if (process.env.LINE_CRASH_STAGE === 'generation') await hold('generation'); return 'fixture reply'; },
  sendReply: async () => hold('sending'),
});
await worker.runOnce(process.env.LINE_JOB_ID);
