import { randomUUID } from 'node:crypto';
import { transaction } from '../../lib/db.js';
import { ApiError } from '../../utils/validation.js';

import { now, wrap } from './common.js';
import { countToNumber } from '../../lib/postgresql-schema.js';
import { recoverAgentDeliveries } from './agentReplies.js';

const publicConversation = ({ handover_job_id, ...conversation }) => conversation;

export function createConversationsOperations(db, { get, page }) {
  return {
    async listConversations({ params, query }) {
      const values = [params.shopId];
      const bind = value => { values.push(value); return `$${values.length}`; };
      const conditions = ['c.shop_id = $1'];
      for (const field of ['status', 'channel', 'bot_mode']) {
        if (query[field]) conditions.push(`c.${field} = ${bind(query[field])}`);
      }
      if (query.search) {
        // strpos ค้นเป็นข้อความตรงตัว ไม่ให้ % และ _ กลายเป็น wildcard
        const search = bind(query.search);
        conditions.push(`(strpos(lower(c.customer_name), lower(${search}::text)) > 0
          OR strpos(lower(c.customer_external_id), lower(${search}::text)) > 0)`);
      }
      const where = conditions.join(' AND ');
      const total = (await db.query(`SELECT count(*) AS n FROM conversations c WHERE ${where}`, values)).rows[0].n;
      const { rows } = await db.query(`SELECT c.*,
        (SELECT count(*) FROM messages m WHERE m.shop_id = c.shop_id AND m.conversation_id = c.id) AS message_count,
        (SELECT m.content FROM messages m WHERE m.shop_id = c.shop_id AND m.conversation_id = c.id
          ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_message
        FROM conversations c WHERE ${where} ORDER BY c.updated_at DESC, c.id DESC
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, query.limit, query.offset]);
      return {
        data: rows.map(row => ({ ...publicConversation(row), message_count: countToNumber(row.message_count) })),
        meta: { limit: query.limit, offset: query.offset, total: countToNumber(total) },
      };
    },
    async createConversation({ params, body }) {
      const id = randomUUID(), time = now();
      await db.query('INSERT INTO conversations (id,shop_id,channel,customer_external_id,customer_name,status,bot_mode,created_at,updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [id, params.shopId, body.channel, body.customer_external_id, body.customer_name, 'open', 'active', time, time]);
      return wrap(publicConversation(await get('conversations', params.shopId, id)));
    },
    async getConversation({ params }) { return wrap(publicConversation(await get('conversations', params.shopId, params.conversationId))); },
    async updateConversation({ params, body }) {
      return transaction(db, async tx => {
        const { shopId, conversationId } = params;
        await get('conversations', shopId, conversationId, tx, true);
        await recoverAgentDeliveries(tx, shopId, conversationId);
        // การส่งที่เริ่มไปแล้วเรียกคืนไม่ได้ จึงยังไม่ยืนยันเปลี่ยนโหมดจนส่งเสร็จ
        const sending = await tx.query(`SELECT 1 FROM agent_deliveries WHERE shop_id=$1 AND conversation_id=$2 AND status='sending'
          UNION ALL SELECT 1 FROM line_jobs WHERE shop_id=$1 AND conversation_id=$2 AND status='processing' AND delivery_state='sending'`, [shopId, conversationId]);
        if (sending.rowCount) throw new ApiError(409, 'DELIVERY_IN_PROGRESS', 'A message is being sent; wait and refresh before changing mode');
        const fields = Object.keys(body);
        if (fields.some(field => !['bot_mode', 'status'].includes(field))) throw new ApiError(422, 'VALIDATION_ERROR', 'Unsupported conversation field');
        const values = Object.values(body);
        await tx.query(`UPDATE conversations SET ${fields.map((field, i) => `${field}=$${i + 1}`).join(',')},updated_at=clock_timestamp()
          WHERE shop_id=$${values.length + 1} AND id=$${values.length + 2}`, [...values, shopId, conversationId]);
        return wrap(publicConversation(await get('conversations', shopId, conversationId, tx)));
      });
    },
    async listMessages({ params, query }) {
      await get('conversations', params.shopId, params.conversationId);
      // PostgreSQL ไม่มี rowid; ใช้ลำดับ created_at, id ตาม helper ของ master
      return page('messages', 'shop_id = ? AND conversation_id = ?', [params.shopId, params.conversationId], query);
    },
    async createMessage({ params, body, user }) {
      return transaction(db, async tx => {
        const conversation = await get('conversations', params.shopId, params.conversationId, tx, true);
        if (conversation.status === 'closed') throw new ApiError(409, 'CONVERSATION_CLOSED', 'Reopen the conversation before adding messages');
        if (body.role === 'agent' && conversation.bot_mode === 'active') throw new ApiError(409, 'BOT_ACTIVE', 'Pause the bot or select human mode before replying as an agent');
        const id = randomUUID(), time = now();
        await tx.query('INSERT INTO messages (id,shop_id,conversation_id,role,content,author_user_id,created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)', [id, params.shopId, params.conversationId, body.role, body.content, body.role === 'agent' ? user.id : null, time]);
        await tx.query('UPDATE conversations SET updated_at = $1 WHERE shop_id = $2 AND id = $3', [time, params.shopId, params.conversationId]);
        return wrap(await get('messages', params.shopId, id, tx));
      });
    },
  };
}
