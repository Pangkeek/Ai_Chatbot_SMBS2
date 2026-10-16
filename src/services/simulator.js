import { prepareReply, saveReplySources } from './replyEvidence.js';
import { randomUUID } from 'node:crypto';
import { sendLineReply } from './line.js';
import { transaction } from '../lib/db.js';

const now = () => new Date().toISOString();

// Development-only synchronous simulator; real webhooks use durable jobs.
export function createLineSimulator(db, options = {}) {
  const replySender = options.sendReply || sendLineReply;
  const updateEvent = (executor, shopId, eventId, status) => executor.query(
    'UPDATE line_events SET status=$1 WHERE shop_id=$2 AND event_id=$3', [status, shopId, eventId || null]);

  async function handleMessageEvent({ shopId, event, channelConfig, simulated = false }) {
    if (process.env.NODE_ENV === 'production') throw new Error('LINE simulator is disabled in production');
    const userId = event.source?.userId || 'unknown-line-user';
    const messageText = event.message?.text || '';
    const customerMsgId = randomUUID();
    const conversation = await transaction(db, async tx => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))', [shopId, userId]);
      let conversation = (await tx.query(`SELECT * FROM conversations WHERE shop_id=$1 AND channel='line'
        AND customer_external_id=$2 AND status='open' ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE`, [shopId, userId])).rows[0];
      const time = now();
      if (!conversation) {
        conversation = (await tx.query(`INSERT INTO conversations
          (id,shop_id,channel,customer_external_id,customer_name,status,bot_mode,created_at,updated_at)
          VALUES ($1,$2,'line',$3,$4,'open','active',$5,$5) RETURNING *`,
        [randomUUID(), shopId, userId, `LINE User ${userId.slice(-4)}`, time])).rows[0];
      }
      await tx.query(`INSERT INTO messages (id,shop_id,conversation_id,role,content,author_user_id,created_at)
        VALUES ($1,$2,$3,'customer',$4,NULL,$5)`, [customerMsgId, shopId, conversation.id, messageText, time]);
      await tx.query('UPDATE conversations SET updated_at=$1 WHERE shop_id=$2 AND id=$3', [time, shopId, conversation.id]);
      return conversation;
    });
    const base = { conversationId: conversation.id, customerMsgId, replied: false };
    if (conversation.bot_mode !== 'active' || conversation.status !== 'open') {
      await updateEvent(db, shopId, event.webhookEventId, 'completed');
      return { ...base, reason: conversation.bot_mode };
    }
    const shop = (await db.query('SELECT * FROM shops WHERE id=$1', [shopId])).rows[0];
    // No checked-out transaction client is held during generation or HTTP delivery.
    const answer = await prepareReply(db, { shop, conversation, messageText }, options);
    const replyText = answer.text;
    const latest = (await db.query('SELECT status,bot_mode FROM conversations WHERE shop_id=$1 AND id=$2', [shopId, conversation.id])).rows[0];
    if (!latest || latest.status !== 'open' || latest.bot_mode !== 'active') {
      await updateEvent(db, shopId, event.webhookEventId, 'completed');
      return { ...base, reason: latest?.bot_mode || 'closed' };
    }
    let sent = simulated;
    if (!simulated && event.replyToken && channelConfig?.channel_access_token) {
      try {
        await replySender({ channelAccessToken: channelConfig.channel_access_token, replyToken: event.replyToken,
          messages: [{ type: 'text', text: replyText }], fetchImpl: options.fetchImpl });
        sent = true;
      } catch { if (options.logErrors !== false) console.warn('LINE reply failed'); }
    }
    if (!sent) {
      await updateEvent(db, shopId, event.webhookEventId, 'failed');
      return base;
    }
    const replyMsgId = randomUUID();
    await transaction(db, async tx => {
      const time = now();
      await tx.query(`INSERT INTO messages (id,shop_id,conversation_id,role,content,author_user_id,created_at)
        VALUES ($1,$2,$3,'assistant',$4,NULL,$5)`, [replyMsgId, shopId, conversation.id, replyText, time]);
      await tx.query('UPDATE conversations SET updated_at=$1 WHERE shop_id=$2 AND id=$3', [time, shopId, conversation.id]);
      await saveReplySources(tx, shopId, replyMsgId, answer.sources);
      await updateEvent(tx, shopId, event.webhookEventId, 'completed');
    });
    return { ...base, replyMsgId, replyText, replied: true, replyMethod: answer.method,
      sourceKnowledgeIds: [...new Set(answer.sources.map(source => source.knowledge_entry_id))] };
  }
  return { handleMessageEvent };
}
