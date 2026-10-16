import { randomUUID } from 'node:crypto';
import { transaction } from '../../lib/db.js';
import { ApiError } from '../../utils/validation.js';

import { now, wrap } from './common.js';

export function createConversationsOperations(db, { get, page, patch }) {
  return {
    async listConversations({ params, query }) { return page('conversations', 'shop_id = ?', [params.shopId], query); },
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
