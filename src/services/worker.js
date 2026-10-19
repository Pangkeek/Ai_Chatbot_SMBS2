import { prepareReply, saveReplySources } from './replyEvidence.js';
import { randomUUID } from 'node:crypto';
import { transaction } from '../lib/db.js';
import { sendLineReply } from './line.js';
import { createLineSimulator } from './simulator.js';
import { messageId, recordLineEvents } from './lineJobs.js';
import { withConfiguredGenerator } from './ai/config.js';
import { claimHandover, maySendReply } from './ai/handover.js';

class LeaseLost extends Error {}
const transient = error => ['08000','08003','08006','57P01','57P02','57P03','40001','40P01','ECONNRESET','ECONNREFUSED','ETIMEDOUT'].includes(error?.code);

export function createLineWorker(db, options = {}) {
  options = withConfiguredGenerator(options);
  const workerId = options.workerId || randomUUID();
  // Generation uses at most 28s and reserves 12s for checkpoint/delivery within the 45s cutoff.
  const leaseMs = options.leaseMs ?? 15000;
  const heartbeatMs = options.heartbeatMs ?? 3000;
  const pollMs = options.pollMs ?? 1000;
  const cutoffMs = options.cutoffMs ?? 45000;
  const httpTimeoutMs = options.httpTimeoutMs ?? 10000;
  const simulator = createLineSimulator(db, options);
  let stopped = false, started = false, active = null, timer = null, controller = null;
  const log = (code, job) => { if (options.logErrors !== false) console.warn('LINE_JOB', code, job?.job_id || 'poll'); };

  async function owned(tx, job) {
    const current = (await tx.query(`SELECT * FROM line_jobs WHERE job_id=$1 AND status='processing'
      AND locked_by=$2 AND lease_until>clock_timestamp() FOR UPDATE`, [job.job_id, workerId])).rows[0];
    if (!current) throw new LeaseLost();
    return current;
  }
  async function terminal(tx, job, status, code = null, delivery = job.delivery_state) {
    await owned(tx, job);
    await tx.query(`UPDATE line_jobs SET status=$2,delivery_state=$3,last_error_code=$4,
      locked_at=NULL,lease_until=NULL,locked_by=NULL,updated_at=clock_timestamp() WHERE job_id=$1`,
    [job.job_id, status, delivery, code]);
    await tx.query('UPDATE line_events SET status=$3 WHERE shop_id=$1 AND event_id=$2',
      [job.shop_id, job.event_id, status === 'unknown' ? 'failed' : status]);
    if (code) log(code, job);
  }
  async function recover(tx) {
    // sending is irrevocable: no automatic retry even when a sender died before HTTP.
    const recovered = await tx.query(`WITH recovered AS (
      UPDATE line_jobs SET status=CASE WHEN delivery_state IN ('sending','unknown') THEN 'unknown'
        WHEN attempts>=3 THEN 'failed' ELSE 'pending' END,
        delivery_state=CASE WHEN delivery_state IN ('sending','unknown') THEN 'unknown' ELSE delivery_state END,
        last_error_code=CASE WHEN delivery_state IN ('sending','unknown') THEN 'DELIVERY_UNCERTAIN'
          WHEN attempts>=3 THEN 'ATTEMPTS_EXHAUSTED' ELSE 'LEASE_EXPIRED' END,
        available_at=clock_timestamp(),locked_at=NULL,lease_until=NULL,locked_by=NULL,updated_at=clock_timestamp()
      WHERE status='processing' AND lease_until<=clock_timestamp() RETURNING job_id,shop_id,event_id,status,last_error_code)
      UPDATE line_events e SET status=CASE WHEN r.status='pending' THEN 'received' ELSE 'failed' END
      FROM recovered r WHERE e.shop_id=r.shop_id AND e.event_id=r.event_id RETURNING r.job_id,r.status,r.last_error_code`);
    for (const job of recovered.rows) if (job.status !== 'pending') log(job.last_error_code, job);
  }
  async function claim(jobId) {
    return transaction(db, async tx => {
      await recover(tx);
      const job = (await tx.query(`SELECT * FROM line_jobs WHERE status='pending' AND available_at<=clock_timestamp()
        AND ($1::text IS NULL OR job_id=$1) ORDER BY available_at,job_id FOR UPDATE SKIP LOCKED LIMIT 1`, [jobId || null])).rows[0];
      if (!job) return null;
      const claimed = (await tx.query(`UPDATE line_jobs SET status='processing',attempts=attempts+1,
        locked_at=clock_timestamp(),lease_until=clock_timestamp()+$3*interval '1 millisecond',locked_by=$2,
        updated_at=clock_timestamp() WHERE job_id=$1 RETURNING *`, [job.job_id, workerId, leaseMs])).rows[0];
      await tx.query("UPDATE line_events SET status='processing' WHERE shop_id=$1 AND event_id=$2", [job.shop_id, job.event_id]);
      return claimed;
    });
  }
  async function renew(job) {
    const renewed = await db.query(`UPDATE line_jobs SET lease_until=clock_timestamp()+$3*interval '1 millisecond',
      updated_at=clock_timestamp() WHERE job_id=$1 AND locked_by=$2 AND status='processing'
      AND lease_until>clock_timestamp() RETURNING job_id`, [job.job_id, workerId, leaseMs]);
    if (!renewed.rowCount) throw new LeaseLost();
  }
  async function customerCheckpoint(job) {
    return transaction(db, async tx => {
      const current = await owned(tx, job);
      if (current.customer_message_id) return current;
      const userId = current.payload.source.userId;
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))', [job.shop_id, userId]);
      let conversation = (await tx.query(`SELECT * FROM conversations WHERE shop_id=$1 AND channel='line'
        AND customer_external_id=$2 AND status='open' ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE`, [job.shop_id, userId])).rows[0];
      if (!conversation) conversation = (await tx.query(`INSERT INTO conversations
        (id,shop_id,channel,customer_external_id,customer_name,status,bot_mode,created_at,updated_at)
        VALUES ($1,$2,'line',$3,$4,'open','active',clock_timestamp(),clock_timestamp()) RETURNING *`,
      [randomUUID(), job.shop_id, userId, `LINE User ${userId.slice(-4)}`])).rows[0];
      const id = messageId(job.shop_id, job.event_id, 'customer');
      await tx.query(`INSERT INTO messages (id,shop_id,conversation_id,role,content,author_user_id,created_at)
        VALUES ($1,$2,$3,'customer',$4,NULL,clock_timestamp()) ON CONFLICT (id) DO NOTHING`,
      [id, job.shop_id, conversation.id, current.payload.message.text]);
      await tx.query('UPDATE conversations SET updated_at=clock_timestamp() WHERE shop_id=$1 AND id=$2', [job.shop_id, conversation.id]);
      await owned(tx, job);
      return (await tx.query(`UPDATE line_jobs SET conversation_id=$2,customer_message_id=$3,
        updated_at=clock_timestamp() WHERE job_id=$1 RETURNING *`, [job.job_id, conversation.id, id])).rows[0];
    });
  }
  async function canReply(tx, job) {
    const conversation = (await tx.query('SELECT * FROM conversations WHERE shop_id=$1 AND id=$2 FOR UPDATE', [job.shop_id, job.conversation_id])).rows[0];
    if (!maySendReply(conversation, { method: job.reply_method, ownerId: job.job_id })) {
      await terminal(tx, job, 'completed', 'BOT_INACTIVE'); return false;
    }
    const expired = (await tx.query("SELECT clock_timestamp()>$1::timestamptz+$2*interval '1 millisecond' AS expired", [job.received_at, cutoffMs])).rows[0].expired;
    if (expired) { await terminal(tx, job, 'failed', 'REPLY_WINDOW_EXPIRED'); return false; }
    return true;
  }
  async function processJob(job) {
    let lost = false, renewing = false, sending = false;
    const abort = new AbortController(); controller = abort;
    const heartbeat = setInterval(async () => {
      if (renewing) return;
      renewing = true;
      try { await renew(job); } catch { lost = true; abort.abort(); } finally { renewing = false; }
    }, heartbeatMs);
    heartbeat.unref();
    try {
      job = await customerCheckpoint(job);
      if (lost || stopped) throw new LeaseLost();
      const ready = await transaction(db, async tx => canReply(tx, await owned(tx, job)));
      if (!ready) return job;
      if (!job.reply_text) {
        const shop = (await db.query('SELECT * FROM shops WHERE id=$1', [job.shop_id])).rows[0];
        const conversation = (await db.query('SELECT * FROM conversations WHERE shop_id=$1 AND id=$2', [job.shop_id, job.conversation_id])).rows[0];
        const { budget } = (await db.query(`SELECT GREATEST(0, EXTRACT(EPOCH FROM
          (received_at+$2*interval '1 millisecond'-clock_timestamp()))*1000-12000) AS budget
          FROM line_jobs WHERE job_id=$1`, [job.job_id, cutoffMs])).rows[0];
        const answer = await prepareReply(db, { shop, conversation, messageText: job.payload.message.text }, {
          ...options, jobId: job.job_id, signal: abort.signal, deadlineAt: Date.now() + Math.min(28000, Number(budget)),
        });
        abort.signal.throwIfAborted();
        if (lost || stopped) throw new LeaseLost();
        const reply = answer.text;
        const saved = await transaction(db, async tx => {
          await owned(tx, job);
          const latest = (await tx.query('SELECT * FROM conversations WHERE shop_id=$1 AND id=$2 FOR UPDATE', [job.shop_id, job.conversation_id])).rows[0];
          if (!maySendReply(latest, { method: 'generator' })) {
            await terminal(tx, job, 'completed', 'BOT_INACTIVE'); return false;
          }
          if (answer.method === 'handover') await claimHandover(tx, { shopId: job.shop_id,
            conversationId: job.conversation_id, ownerId: job.job_id, reason: answer.handoverReason });
          await tx.query('UPDATE line_jobs SET reply_text=$2,reply_sources=$3,reply_method=$4,updated_at=clock_timestamp() WHERE job_id=$1', [job.job_id, reply, JSON.stringify(answer.sources), answer.method]);
          return true;
        });
        if (!saved) return job;
        job.reply_text = reply;
        job.reply_sources = answer.sources;
        job.reply_method = answer.method;
      }
      if (lost || stopped) throw new LeaseLost();
      // Credentials are read fresh; never stored in job payload or captured at webhook time.
      const channel = (await db.query('SELECT channel_access_token FROM line_channels WHERE shop_id=$1', [job.shop_id])).rows[0];
      if (!channel?.channel_access_token || !job.payload.replyToken) {
        await transaction(db, async tx => terminal(tx, await owned(tx, job), 'failed', 'REPLY_CREDENTIAL_MISSING')); return job;
      }
      const send = await transaction(db, async tx => {
        const current = await owned(tx, job);
        if (!await canReply(tx, current)) return false;
        await owned(tx, job);
        await tx.query("UPDATE line_jobs SET delivery_state='sending',updated_at=clock_timestamp() WHERE job_id=$1", [job.job_id]);
        return true;
      });
      if (!send) return job;
      sending = true;
      if (lost || stopped) throw new LeaseLost();
      let timeout;
      try {
        await Promise.race([
          (options.sendReply || sendLineReply)({ channelAccessToken: channel.channel_access_token, replyToken: job.payload.replyToken,
            messages: [{ type: 'text', text: job.reply_text }], fetchImpl: options.fetchImpl, signal: abort.signal }),
          new Promise((_, reject) => { timeout = setTimeout(() => { abort.abort(); reject(new Error('Reply timeout')); }, httpTimeoutMs); }),
        ]);
      } finally { clearTimeout(timeout); }
      await transaction(db, async tx => {
        const current = await owned(tx, job);
        const id = messageId(job.shop_id, job.event_id, 'assistant');
        await tx.query(`INSERT INTO messages (id,shop_id,conversation_id,role,content,author_user_id,created_at)
          VALUES ($1,$2,$3,'assistant',$4,NULL,clock_timestamp()) ON CONFLICT (id) DO NOTHING`,
        [id, job.shop_id, job.conversation_id, job.reply_text]);
        await tx.query('UPDATE conversations SET updated_at=clock_timestamp() WHERE shop_id=$1 AND id=$2', [job.shop_id, job.conversation_id]);
        await saveReplySources(tx, job.shop_id, id, job.reply_sources);
        await tx.query('UPDATE line_jobs SET reply_message_id=$2 WHERE job_id=$1', [job.job_id, id]);
        await terminal(tx, current, 'completed', null, 'sent');
        job.reply_message_id = id;
      });
    } catch (error) {
      if (error instanceof LeaseLost || lost) { log('LEASE_LOST', job); return job; }
      try {
        await transaction(db, async tx => {
          const current = await owned(tx, job);
          if (sending || current.delivery_state === 'sending') {
            const rejected = error.code === 'LINE_HTTP_REJECTED';
            await terminal(tx, current, rejected ? 'failed' : 'unknown', rejected ? 'LINE_HTTP_REJECTED' : 'DELIVERY_UNCERTAIN', rejected ? 'pending' : 'unknown');
          } else if (transient(error) && current.attempts < 3) {
            const delay = current.attempts === 1 ? 1000 : 3000;
            const enoughTime = (await tx.query("SELECT clock_timestamp()+$3*interval '1 millisecond'<$1::timestamptz+$2*interval '1 millisecond' AS ok", [current.received_at, cutoffMs, delay])).rows[0].ok;
            if (enoughTime) {
              await tx.query(`UPDATE line_jobs SET status='pending',available_at=clock_timestamp()+$2*interval '1 millisecond',
                locked_at=NULL,lease_until=NULL,locked_by=NULL,last_error_code='PRE_SEND_TRANSIENT',updated_at=clock_timestamp() WHERE job_id=$1`, [job.job_id, delay]);
              await tx.query("UPDATE line_events SET status='received' WHERE shop_id=$1 AND event_id=$2", [job.shop_id, job.event_id]);
            } else await terminal(tx, current, 'failed', 'REPLY_WINDOW_EXPIRED');
          } else await terminal(tx, current, 'failed', transient(error) ? 'ATTEMPTS_EXHAUSTED' : 'PRE_SEND_FAILED');
        });
      } catch { log(sending ? 'DELIVERY_UNCERTAIN' : 'CHECKPOINT_UNAVAILABLE', job); }
    } finally { clearInterval(heartbeat); if (controller === abort) controller = null; }
    return job;
  }
  async function runOnce(jobId) {
    if (stopped) return false;
    if (active) return active;
    active = (async () => { const job = await claim(jobId); if (!job) return false; await processJob(job); return true; })();
    try { return await active; } finally { active = null; }
  }
  function schedule(delay = pollMs) {
    if (stopped || !started) return;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try { const worked = await runOnce(); schedule(worked ? 0 : pollMs); }
      catch { log('POLL_UNAVAILABLE'); schedule(pollMs); }
    }, delay);
    timer.unref();
  }
  const wake = () => { if (!active) schedule(0); };
  async function stop({ timeoutMs = 15000 } = {}) {
    stopped = true; clearTimeout(timer);
    // Let the active HTTP request finish; only revoke its lease after the grace deadline.
    let deadline;
    await Promise.race([active?.catch(() => {}), new Promise(resolve => { deadline = setTimeout(resolve, timeoutMs); })]);
    clearTimeout(deadline); controller?.abort();
    await transaction(db, async tx => {
      // Any in-flight sending checkpoint becomes unknown; fencing blocks late completions.
      await tx.query(`UPDATE line_jobs SET lease_until=clock_timestamp() WHERE status='processing' AND locked_by=$1`, [workerId]);
      await recover(tx);
    }).catch(() => { log('SHUTDOWN_RECOVERY_DEFERRED'); });
  }
  async function handleMessageEvent(input) {
    if (input.simulated) return simulator.handleMessageEvent(input);
    const event = { ...input.event, webhookEventId: input.event.webhookEventId || input.event.message?.id || randomUUID(), type: 'message', message: { ...input.event.message, type: 'text' } };
    await transaction(db, tx => recordLineEvents(tx, input.shopId, [event]));
    const job = (await db.query('SELECT job_id FROM line_jobs WHERE shop_id=$1 AND event_id=$2', [input.shopId, event.webhookEventId || event.message.id])).rows[0];
    await runOnce(job.job_id);
    const result = (await db.query('SELECT * FROM line_jobs WHERE job_id=$1', [job.job_id])).rows[0];
    return { conversationId: result.conversation_id, customerMsgId: result.customer_message_id,
      replied: result.delivery_state === 'sent', replyMethod: result.reply_method,
      sourceKnowledgeIds: [...new Set(result.reply_sources.map(source => source.knowledge_entry_id))], ...(result.reply_message_id ? { replyMsgId: result.reply_message_id, replyText: result.reply_text } : {}),
      reason: result.last_error_code === 'BOT_INACTIVE' ? (await db.query('SELECT bot_mode FROM conversations WHERE id=$1', [result.conversation_id])).rows[0]?.bot_mode : undefined };
  }
  return { workerId, runOnce, renew, wake, handleMessageEvent, start() { if (!started) { started = true; schedule(0); } }, stop,
    getPendingCount: () => active ? 1 : 0,
    async drain() { if (active) await active; while (await runOnce()) {} } };
}
