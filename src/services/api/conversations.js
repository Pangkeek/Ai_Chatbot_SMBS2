import { randomUUID } from 'node:crypto';
import { transaction } from '../../lib/db.js';
import { ApiError } from '../../utils/validation.js';

import { now, wrap } from './common.js';
import { countToNumber } from '../../lib/postgresql-schema.js';

export function createConversationsOperations(db, { get, page, patch }) {
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
        data: rows.map(row => ({ ...row, message_count: countToNumber(row.message_count) })),
        meta: { limit: query.limit, offset: query.offset, total: countToNumber(total) },
      };
    },
    async createConversation({ params, body }) {
      const id = randomUUID(), time = now();
      await db.query('INSERT INTO conversations (id,shop_id,channel,customer_external_id,customer_name,status,bot_mode,created_at,updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [id, params.shopId, body.channel, body.customer_external_id, body.customer_name, 'open', 'active', time, time]);
      return wrap(await get('conversations', params.shopId, id));
    },
    async getConversation({ params }) { return wrap(await get('conversations', params.shopId, params.conversationId)); },
    async updateConversation({ params, body }) {
      await get('conversations', params.shopId, params.conversationId);
      await patch('conversations', body, 'shop_id = ? AND id = ?', [params.shopId, params.conversationId]);
      return this.getConversation({ params });
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
