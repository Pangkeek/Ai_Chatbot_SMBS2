import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { withTestSchema } from './postgresql-fixture.js';
import { migratePostgresql } from '../scripts/postgresql/migrations.js';
import { seedDemo } from '../src/lib/seed.js';
import { recordLineEvents } from '../src/services/lineJobs.js';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(action) {
  const started = Date.now();
  while (!await action()) { if (Date.now()-started>12000) throw new Error('Runtime condition timeout'); await sleep(50); }
}
async function port() { const s = createServer(); s.listen(0,'127.0.0.1'); await once(s,'listening'); const p=s.address().port; await new Promise(r=>s.close(r)); return p; }

test('actual Next startup consumes persisted jobs before first request, flag disables consumer, and SIGTERM/SIGINT exit cleanly', async () => withTestSchema(async ({ db, config }) => {
  await migratePostgresql({ config }); await seedDemo(db);
  const eventId = randomUUID();
  await db.transaction(tx => recordLineEvents(tx, 'shop-coffee', [{ type:'message',webhookEventId:eventId,
    source:{userId:'startup-user'},message:{type:'text',text:'startup recovery'},replyToken:null }]));
  // Force cutoff: this test never sends network traffic to LINE.
  await db.query("UPDATE line_jobs SET received_at=clock_timestamp()-interval '1 minute' WHERE event_id=$1",[eventId]);
  const read = async () => (await db.query('SELECT * FROM line_jobs WHERE event_id=$1',[eventId])).rows[0];
  for (const enabled of ['false','true']) {
    const httpPort = await port(); let output='';
    const child = fork(new URL('./fixtures/next-line-runtime.js',import.meta.url),[],{
      env:{...process.env,DATABASE_URL:config.connectionString,DB_SCHEMA:config.schema,DB_SSL_MODE:'disable',
        NEXT_MANUAL_SIG_HANDLE:'1',LINE_WORKER_ENABLED:enabled,NODE_ENV:'production',PORT:String(httpPort)},
      stdio:['ignore','pipe','pipe','ipc'],
    });
    child.stdout.on('data', chunk=>{output+=chunk;}); child.stderr.on('data',chunk=>{output+=chunk;});
    try {
      if(enabled==='true') {
        // Only database polling here: no request wakes the consumer.
        await until(async()=> (await read()).status==='failed');
        assert.ok((await read()).customer_message_id); assert.equal((await read()).last_error_code,'REPLY_WINDOW_EXPIRED');
      }
      await until(async()=> { try { return (await fetch(`http://127.0.0.1:${httpPort}/api/health`)).status===200; } catch{return false;} });
      if(enabled==='false') { await sleep(1200); assert.equal((await read()).status,'pending'); }
      const signal=enabled==='true'?'SIGTERM':'SIGINT';
      const exit=once(child,'exit');
      if (process.platform==='win32') child.send({signal}); else child.kill(signal);
      const [code] = await Promise.race([exit,sleep(5000).then(()=>{throw new Error('Next signal shutdown hung');})]);
      assert.equal(code,enabled==='true'?143:130);
      assert.ok(!output.includes('fixture-token')); assert.ok(!output.includes(config.connectionString));
    } finally { if(child.exitCode===null&&child.signalCode===null) child.kill('SIGKILL'); }
  }
}));
