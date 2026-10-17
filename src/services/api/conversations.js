import { randomUUID } from 'node:crypto';
import { transaction } from '../../lib/db.js';
import { ApiError } from '../../utils/validation.js';
import { now, wrap } from './common.js';

// รวมคำสั่ง API ที่เกี่ยวกับ conversations ไว้ในไฟล์เดียว
export function createConversationsOperations(db, { get, page, patch }) {
  return {
    listConversations({ params, query }) {
      const conditions = ['c.shop_id = ?'];
      const values = [params.shopId];
      for (const field of ['status', 'channel', 'bot_mode']) {
        if (query[field]) { conditions.push(`c.${field} = ?`); values.push(query[field]); }
      }
      if (query.search) {
        // ใช้ instr แทน LIKE เพื่อให้ % และ _ เป็นข้อความค้นหาตามตัวอักษร
        conditions.push('(instr(lower(c.customer_name), lower(?)) > 0 OR instr(lower(c.customer_external_id), lower(?)) > 0)');
        values.push(query.search, query.search);
      }
      const where = conditions.join(' AND ');
      const total = db.prepare(`SELECT count(*) AS n FROM conversations c WHERE ${where}`).get(...values).n;
      const rows = db.prepare(`SELECT c.*,
        (SELECT count(*) FROM messages m WHERE m.shop_id = c.shop_id AND m.conversation_id = c.id) AS message_count,
        (SELECT m.content FROM messages m WHERE m.shop_id = c.shop_id AND m.conversation_id = c.id
          ORDER BY m.created_at DESC, m.rowid DESC LIMIT 1) AS last_message
        FROM conversations c WHERE ${where} ORDER BY c.updated_at DESC, c.id DESC LIMIT ? OFFSET ?`)
        .all(...values, query.limit, query.offset);
      return { data: rows, meta: { limit: query.limit, offset: query.offset, total } };
    },
    createConversation({ params, body }) {
      const id = randomUUID(), time = now();
      db.prepare('INSERT INTO conversations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, params.shopId, body.channel, body.customer_external_id, body.customer_name, 'open', 'active', time, time);
      return wrap(get('conversations', params.shopId, id));
    },
    getConversation({ params }) { return wrap(get('conversations', params.shopId, params.conversationId)); },
    updateConversation({ params, body }) {
      get('conversations', params.shopId, params.conversationId);
      patch('conversations', body, 'shop_id = ? AND id = ?', [params.shopId, params.conversationId]);
      return this.getConversation({ params });
    },
    listMessages({ params, query }) {
      get('conversations', params.shopId, params.conversationId);
      const values = [params.shopId, params.conversationId];
      const total = db.prepare('SELECT count(*) AS n FROM messages WHERE shop_id = ? AND conversation_id = ?').get(...values).n;
      // rowid รักษาลำดับรับข้อความเมื่อเวลาตรงกันในระดับมิลลิวินาที
      const rows = db.prepare('SELECT * FROM messages WHERE shop_id = ? AND conversation_id = ? ORDER BY created_at, rowid LIMIT ? OFFSET ?')
        .all(...values, query.limit, query.offset);
      return { data: rows, meta: { limit: query.limit, offset: query.offset, total } };
    },
    createMessage({ params, body, user }) {
      return transaction(db, () => {
        const conversation = get('conversations', params.shopId, params.conversationId);
        if (conversation.status === 'closed') throw new ApiError(409, 'CONVERSATION_CLOSED', 'Reopen the conversation before adding messages');
        if (body.role === 'agent' && conversation.bot_mode === 'active') throw new ApiError(409, 'BOT_ACTIVE', 'Pause the bot or select human mode before replying as an agent');
        const id = randomUUID(), time = now();
        db.prepare('INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, params.shopId, params.conversationId, body.role, body.content, body.role === 'agent' ? user.id : null, time);
        db.prepare('UPDATE conversations SET updated_at = ? WHERE shop_id = ? AND id = ?').run(time, params.shopId, params.conversationId);
        return wrap(get('messages', params.shopId, id));
      });
    },
  };
}
