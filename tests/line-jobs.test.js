import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { withTestSchema } from '../integration/postgresql-fixture.js';
import { migratePostgresql } from '../scripts/postgresql/migrations.js';
import { seedDemo } from '../src/lib/seed.js';
import { createService } from '../src/services/service.js';
import { createLineWorker } from '../src/services/worker.js';
import { sendLineReply } from '../src/services/line.js';
import { cleanupLineHistory } from '../src/services/lineRetention.js';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(action, timeout = 5000) {
  const start = Date.now();
  while (!await action()) { if (Date.now() - start > timeout) throw new Error('Condition timeout'); await sleep(15); }
}
async function seeded(action) {
  await withTestSchema(async fixture => {
    await migratePostgresql({ config: fixture.config }); await seedDemo(fixture.db);
    const service = createService(fixture.db, { worker: { wake() {} } });
    for (const shopId of ['shop-coffee', 'shop-flower']) await service.updateLineConfig({ params: { shopId }, body: {
      channel_secret: 'fixture-secret', channel_access_token: 'fixture-token', destination_user_id: 'fixture-bot',
    } });
    const submit = async (events, shopId = 'shop-coffee', extra = {}) => {
      const body = { destination: 'fixture-bot', events, ...extra }, rawBody = JSON.stringify(body);
      return service.lineWebhook({ params: { shopId }, body, rawBody,
        headers: { 'x-line-signature': createHmac('sha256', 'fixture-secret').update(rawBody).digest('base64') } });
    };
    const job = async eventId => (await fixture.db.query('SELECT * FROM line_jobs WHERE event_id=$1', [eventId])).rows[0];
    await action({ ...fixture, service, submit, job });
  });
}
const event = (overrides = {}) => ({ type: 'message', webhookEventId: randomUUID(), replyToken: 'fixture-reply',
  source: { userId: 'fixture-user' }, message: { type: 'text', text: 'สวัสดี 🌿' }, ...overrides });
const expire = (db, jobId) => db.query("UPDATE line_jobs SET locked_at=clock_timestamp()-interval '2 minutes',lease_until=clock_timestamp()-interval '1 second' WHERE job_id=$1", [jobId]);
const worker = (db, options = {}) => createLineWorker(db, { sendReply: async () => {}, logErrors: false, ...options });

test('webhook atomically persists allowlisted jobs, deduplicates concurrent requests, and rejects invalid/cross-shop events', async () => seeded(async ({ db, submit, job }) => {
  const e = event();
  const responses = await Promise.all([submit([e]), submit([e])]);
  assert.deepEqual(responses.map(r => r.data.processed_count).sort(), [0,1]);
  assert.equal((await job(e.webhookEventId)).status, 'pending');
  assert.deepEqual(Object.keys((await job(e.webhookEventId)).payload).sort(), ['message','replyToken','source']);
  await assert.rejects(submit([e], 'shop-flower'), { code: 'LINE_EVENT_COLLISION' });
  await assert.rejects(submit([event()], 'shop-coffee', { destination: 'other-bot' }), { status: 422 });
  const before = Number((await db.query('SELECT count(*) FROM line_events')).rows[0].count);
  const acceptedFirst = event();
  await assert.rejects(submit([acceptedFirst, event({ webhookEventId: undefined, message: { type: 'text', text: 'bad' } })]), { status: 422 });
  assert.equal(Number((await db.query('SELECT count(*) FROM line_events')).rows[0].count), before);
  assert.equal(await job(acceptedFirst.webhookEventId), undefined);
  await db.query("CREATE FUNCTION fail_job() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture'; END $$");
  await db.query('CREATE TRIGGER fail_job BEFORE INSERT ON line_jobs FOR EACH ROW EXECUTE FUNCTION fail_job()');
  const rollback = event(); await assert.rejects(submit([rollback]));
  assert.equal((await db.query('SELECT 1 FROM line_events WHERE event_id=$1', [rollback.webhookEventId])).rowCount, 0);
  await db.query('DROP TRIGGER fail_job ON line_jobs');
  const ignored = event({ type: 'follow' }); await submit([ignored]);
  assert.equal((await db.query('SELECT status FROM line_events WHERE event_id=$1', [ignored.webhookEventId])).rows[0].status, 'ignored');
  assert.equal(await job(ignored.webhookEventId), undefined);
  assert.equal((await submit([])).data.processed_count, 0);
  await assert.rejects(submit([event({ type: 'follow', webhookEventId: undefined })]), { status: 422 });
  const fallback = event({ webhookEventId: undefined, message: { id: 'fallback-message-id', type: 'text', text: 'fallback' } });
  assert.equal((await submit([fallback])).data.processed_count, 1);
  assert.equal((await submit([fallback])).data.processed_count, 0);
}));

test('two consumers use SKIP LOCKED and serialize same-customer conversation creation without duplicate messages', async () => seeded(async ({ db, submit, job }) => {
  const events = [event(), event()]; await submit(events);
  let sent = 0;
  const a = worker(db, { sendReply: async () => { sent++; } }), b = worker(db, { sendReply: async () => { sent++; } });
  await Promise.all([a.runOnce(), b.runOnce()]);
  assert.equal(sent, 2);
  const jobs = await Promise.all(events.map(e => job(e.webhookEventId)));
  assert.equal(jobs[0].conversation_id, jobs[1].conversation_id);
  assert.ok(jobs.every(j => j.status === 'completed' && j.delivery_state === 'sent' && j.attempts === 1));
  assert.equal((await db.query('SELECT 1 FROM messages WHERE conversation_id=$1', [jobs[0].conversation_id])).rowCount, 4);
  await submit(events); await a.drain(); assert.equal(sent, 2);
}));

test('heartbeat keeps lease alive; revoked ownership blocks stale worker checkpoints and HTTP send', async () => seeded(async ({ db, submit, job }) => {
  const e = event(); await submit([e]);
  let release, generated = false, sent = 0;
  const barrier = new Promise(resolve => { release = resolve; });
  const a = worker(db, { leaseMs: 250, heartbeatMs: 30, generateReply: async () => { generated = true; await barrier; return 'reply'; }, sendReply: async () => { sent++; } });
  const running = a.runOnce(); await until(() => generated); await sleep(450);
  const current = await job(e.webhookEventId);
  assert.ok(current.lease_until > new Date());
  assert.equal(await worker(db).runOnce(), false);
  await db.query("UPDATE line_jobs SET locked_by='replacement' WHERE job_id=$1", [current.job_id]);
  release(); await running;
  assert.equal(sent, 0); assert.equal((await job(e.webhookEventId)).reply_text, null);
  await assert.rejects(a.renew(current));
  await expire(db, current.job_id); await worker(db).runOnce();
  assert.equal((await job(e.webhookEventId)).status, 'completed');
  assert.equal((await db.query('SELECT 1 FROM messages WHERE id=$1', [current.customer_message_id])).rowCount, 1);
}));

test('expired pending/sending leases recover differently and imported history is never replayed', async () => seeded(async ({ db, submit, job }) => {
  const e = event(); await submit([e]); const current = await job(e.webhookEventId);
  await db.query("UPDATE line_jobs SET status='processing',attempts=1,locked_by='dead',locked_at=clock_timestamp()-interval '2 minutes',lease_until=clock_timestamp()-interval '1 second',delivery_state='sending' WHERE job_id=$1", [current.job_id]);
  await db.query("INSERT INTO line_events (event_id,shop_id,event_type,status,created_at) VALUES ('imported-history','shop-coffee','message','processing',clock_timestamp())");
  let sent = 0; const a = worker(db, { sendReply: async () => { sent++; } });
  await a.drain(); assert.equal(sent, 0);
  assert.equal((await job(e.webhookEventId)).status, 'unknown');
  assert.equal((await job(e.webhookEventId)).delivery_state, 'unknown');
  assert.equal((await db.query("SELECT status FROM line_events WHERE event_id='imported-history'")).rows[0].status, 'processing');
}));

test('LINE HTTP rejection is failed; disconnect/timeout and DB failure after send are unknown without assistant rows or retries', async () => seeded(async ({ db, submit, job }) => {
  const events = [event(), event(), event(), event()]; await submit(events);
  const senders = [
    () => sendLineReply({ channelAccessToken: 'fixture-token', replyToken: 'fixture-reply', messages: [{ type: 'text', text: 'ok' }], fetchImpl: async () => new Response('secret payload', { status: 400 }) }),
    async () => { throw new Error('disconnect-secret'); },
    () => new Promise(() => {}),
    async () => {},
  ];
  for (let i = 0; i < events.length; i++) {
    const current = await job(events[i].webhookEventId);
    if (i === 3) {
      await db.query("CREATE FUNCTION fail_assistant() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.role='assistant' THEN RAISE EXCEPTION 'fixture'; END IF; RETURN NEW; END $$");
      await db.query('CREATE TRIGGER fail_assistant BEFORE INSERT ON messages FOR EACH ROW EXECUTE FUNCTION fail_assistant()');
    }
    await worker(db, { sendReply: senders[i], httpTimeoutMs: 30 }).runOnce(current.job_id);
    const result = await job(events[i].webhookEventId);
    assert.equal(result.status, i === 0 ? 'failed' : 'unknown');
    assert.equal(result.reply_message_id, null);
    assert.equal((await db.query("SELECT 1 FROM messages WHERE conversation_id=$1 AND role='assistant'", [result.conversation_id])).rowCount, 0);
    assert.ok(!JSON.stringify(result).includes('disconnect-secret'));
  }
  await db.query('DROP TRIGGER fail_assistant ON messages');
  let resent = 0; await worker(db, { sendReply: async () => { resent++; } }).drain(); assert.equal(resent, 0);
}));

test('reply cutoff keeps customer message, bot state is reread, and fresh credentials are loaded at execution', async () => seeded(async ({ db, submit, job }) => {
  const expired = event(); await submit([expired]);
  await db.query("UPDATE line_jobs SET received_at=clock_timestamp()-interval '1 minute' WHERE event_id=$1", [expired.webhookEventId]);
  let sent = 0; const a = worker(db, { sendReply: async () => { sent++; } });
  await a.runOnce(); const j = await job(expired.webhookEventId);
  assert.equal(j.last_error_code, 'REPLY_WINDOW_EXPIRED'); assert.ok(j.customer_message_id); assert.equal(sent, 0);
  const paused = event(); await submit([paused]);
  await worker(db, { sendReply: async () => { sent++; }, generateReply: async ({ conversation }) => {
    await db.query("UPDATE conversations SET bot_mode='human' WHERE id=$1", [conversation.id]); return 'answer';
  } }).runOnce();
  assert.equal((await job(paused.webhookEventId)).last_error_code, 'BOT_INACTIVE'); assert.equal(sent, 0);
  const fresh = event({ source: { userId: 'fresh-user' } }); await submit([fresh]);
  await db.query("UPDATE line_channels SET channel_access_token='rotated-token' WHERE shop_id='shop-coffee'");
  await worker(db, { sendReply: async ({ channelAccessToken }) => { assert.equal(channelAccessToken, 'rotated-token'); sent++; } }).runOnce();
  assert.equal(sent, 1);
}));

test('pre-send transient failures retry at most three times with backoff; generation failure never enters sending', async () => seeded(async ({ db, submit, job }) => {
  const e = event(); await submit([e]); let attempts = 0, sent = 0;
  const a = worker(db, { generateReply: async () => { attempts++; const error = new Error('temporary'); error.code = '40001'; throw error; }, sendReply: async () => { sent++; } });
  for (let i = 1; i <= 3; i++) {
    const before = new Date(); await a.runOnce(); const current = await job(e.webhookEventId);
    assert.equal(current.attempts, i); assert.equal(current.delivery_state, 'pending');
    if (i < 3) { assert.equal(current.status, 'pending'); assert.ok(current.available_at - before >= (i === 1 ? 900 : 2900)); await db.query('UPDATE line_jobs SET available_at=clock_timestamp() WHERE job_id=$1', [current.job_id]); }
    else assert.equal(current.last_error_code, 'ATTEMPTS_EXHAUSTED');
  }
  assert.equal(attempts, 3); assert.equal(sent, 0);
  const bad = event(); await submit([bad]); await worker(db, { generateReply: async () => { throw new Error('bad'); } }).runOnce();
  assert.equal((await job(bad.webhookEventId)).status, 'failed');
}));

test('shutdown returns pre-send lease within grace deadline and fences a late generation result', async () => seeded(async ({ db, submit, job }) => {
  const e = event(); await submit([e]); let generated = false, release, sent = 0;
  const barrier = new Promise(resolve => { release = resolve; });
  const a = worker(db, { generateReply: async () => { generated = true; await barrier; return 'answer'; }, sendReply: async () => { sent++; } });
  const running = a.runOnce(); await until(() => generated);
  const start = Date.now(); await a.stop({ timeoutMs: 25 }); assert.ok(Date.now() - start < 1000);
  assert.equal((await job(e.webhookEventId)).status, 'pending');
  release(); await running; assert.equal(sent, 0);
  await worker(db).runOnce(); assert.equal((await job(e.webhookEventId)).status, 'completed');
}));

test('retention clears terminal payloads/tokens after 30 days and retains deduplication/history/active work', async () => seeded(async ({ db, submit, job }) => {
  const done = event(), pending = event(); await submit([done]); await worker(db).runOnce(); await submit([pending]);
  await db.query("UPDATE line_jobs SET updated_at=clock_timestamp()-interval '31 days' WHERE event_id=$1", [done.webhookEventId]);
  await db.query("UPDATE line_events SET created_at=clock_timestamp()-interval '31 days'");
  const result = await cleanupLineHistory(db); assert.ok(result.jobs >= 1);
  assert.deepEqual((await job(done.webhookEventId)).payload, {}); assert.equal((await job(done.webhookEventId)).reply_text, null);
  assert.equal((await db.query('SELECT reply_token FROM line_events WHERE event_id=$1', [done.webhookEventId])).rows[0].reply_token, null);
  assert.ok((await job(pending.webhookEventId)).payload.replyToken);
  assert.equal((await submit([done])).data.processed_count, 0);
  assert.equal((await cleanupLineHistory(db)).jobs, 0);
}));

test('real child process crash recovers customer checkpoint; crash during HTTP is unknown and never sent again', async () => seeded(async ({ db, config, submit, job }) => {
  for (const stage of ['generation','sending']) {
    const e = event({ source: { userId: stage } }); await submit([e]); const current = await job(e.webhookEventId);
    const child = fork(new URL('./fixtures/line-worker-child.js', import.meta.url), [], {
      env: { ...process.env, DB_SCHEMA: config.schema, LINE_CRASH_STAGE: stage, LINE_JOB_ID: current.job_id }, stdio: ['ignore','ignore','ignore','ipc'],
    });
    try {
      await Promise.race([once(child, 'message'), sleep(5000).then(() => { throw new Error('Child checkpoint timeout'); })]);
      const exit = once(child, 'exit'); child.kill('SIGKILL'); await exit;
      const before = await job(e.webhookEventId); assert.ok(before.customer_message_id);
      await expire(db, current.job_id);
      let sent = 0; await worker(db, { sendReply: async () => { sent++; } }).runOnce();
      const after = await job(e.webhookEventId);
      assert.equal(after.status, stage === 'generation' ? 'completed' : 'unknown');
      assert.equal(sent, stage === 'generation' ? 1 : 0);
      assert.equal(after.customer_message_id, before.customer_message_id);
      assert.equal((await db.query('SELECT 1 FROM messages WHERE id=$1', [before.customer_message_id])).rowCount, 1);
    } finally { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }
  }
}));

test('DB disconnect before send retries without partial customer rows; polling resumes after an outage without a new webhook', async () => seeded(async ({ db, submit, job }) => {
  const e = event(); await submit([e]);
  await db.query('CREATE SEQUENCE disconnect_once');
  await db.query("CREATE FUNCTION disconnect_customer() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.role='customer' AND nextval('disconnect_once')=1 THEN PERFORM pg_terminate_backend(pg_backend_pid()); END IF; RETURN NEW; END $$");
  await db.query('CREATE TRIGGER disconnect_customer BEFORE INSERT ON messages FOR EACH ROW EXECUTE FUNCTION disconnect_customer()');
  let sends=0; const a=worker(db,{sendReply:async()=>{sends++;}});
  await a.runOnce(); const retry=await job(e.webhookEventId);
  assert.equal(retry.status,'pending'); assert.equal(retry.customer_message_id,null); assert.equal(sends,0);
  await db.query('UPDATE line_jobs SET available_at=clock_timestamp() WHERE job_id=$1',[retry.job_id]);
  let failures=1;
  const unreliable={...db,transaction:async action=>{if(failures-->0){const error=new Error('outage');error.code='ECONNREFUSED';throw error;}return db.transaction(action);}};
  const b=worker(unreliable,{pollMs:20,sendReply:async()=>{sends++;}});
  b.start(); try { await until(async()=>(await job(e.webhookEventId)).status==='completed'); } finally { await b.stop(); }
  assert.equal(sends,1); assert.equal((await job(e.webhookEventId)).attempts,2);
}));

test('shutdown during an unconfirmed send marks unknown and fences the late sender', async () => seeded(async ({ db,submit,job })=>{
  const e=event(); await submit([e]); let sending=false;
  const a=worker(db,{httpTimeoutMs:80,sendReply:async()=>{sending=true;await new Promise(()=>{});}});
  const running=a.runOnce();await until(()=>sending);await a.stop({timeoutMs:10});
  assert.equal((await job(e.webhookEventId)).status,'unknown');await running;
  let sends=0;await worker(db,{sendReply:async()=>{sends++;}}).drain();assert.equal(sends,0);
  assert.equal((await job(e.webhookEventId)).reply_message_id,null);
}));

test('recovered pre-send jobs retain their original RAG evidence across a worker restart', async () => seeded(async ({db,submit,job}) => {
  const e=event({message:{type:'text',id:randomUUID(),text:'ร้านเปิดกี่โมงครับ'}});
  await submit([e]);
  const source={knowledge_entry_id:'shop-coffee-kb-1',chunk_id:'shop-coffee-kb-1:0',content:'Original verified excerpt'};
  await db.query(`UPDATE line_jobs SET reply_text='Original reply',reply_sources=$1,reply_method='faq',
    status='processing',attempts=1,locked_by='previous-worker',locked_at=now()-interval '2 seconds',lease_until=now()-interval '1 second',
    conversation_id='shop-coffee-conversation-1',customer_message_id='shop-coffee-message-1' WHERE event_id=$2`,[JSON.stringify([source]),e.webhookEventId]);
  await db.query("DELETE FROM knowledge_entries WHERE id='shop-coffee-kb-1'");
  let sends=0;
  await createLineWorker(db,{sendReply:async({messages})=>{sends++;assert.equal(messages[0].text,'Original reply');},
    generateReply:async()=>{throw new Error('Persisted reply must not be regenerated');},logErrors:false}).drain();
  assert.equal(sends,1);
  const result=await job(e.webhookEventId);
  assert.equal(result.status,'completed');
  const audit=(await db.query('SELECT * FROM message_sources WHERE message_id=$1',[result.reply_message_id])).rows;
  assert.equal(audit.length,1);
  assert.equal(audit[0].source_excerpt,source.content);
}));
