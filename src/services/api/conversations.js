import { randomUUID } from 'node:crypto';
import { transaction } from '../../lib/db.js';
import { ApiError } from '../../utils/validation.js';
import { now, wrap } from './common.js';

// รวมคำสั่ง API ที่เกี่ยวกับ conversations ไว้ในไฟล์เดียว
export function createConversationsOperations(db, { get, page, patch }) {
  return {
    listConversations({ params, query }) { return page('conversations', 'shop_id = ?', [params.shopId], query); },
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
      return page('messages', 'shop_id = ? AND conversation_id = ?', [params.shopId, params.conversationId], query);
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
