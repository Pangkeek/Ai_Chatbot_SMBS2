import { randomUUID } from 'node:crypto';
import { transaction } from './db.mjs';
import { hashPassword, verifyPassword, createSession } from './auth.mjs';
import { ApiError } from './validation.mjs';

export const publicUser = user => ({ id: user.id, email: user.email, name: user.name, created_at: user.created_at });
const now = () => new Date().toISOString();
const missing = () => { throw new ApiError(404, 'NOT_FOUND', 'Resource not found'); };
const wrap = value => ({ data: value });

export function createService(db) {
  function get(table, shopId, id) {
    // table is always an internal literal; all external values are bound parameters.
    return db.prepare(`SELECT * FROM ${table} WHERE shop_id = ? AND id = ?`).get(shopId, id) || missing();
  }
  function page(table, where, values, query) {
    const { limit, offset } = query;
    const total = db.prepare(`SELECT count(*) AS n FROM ${table} WHERE ${where}`).get(...values).n;
    const rows = db.prepare(`SELECT * FROM ${table} WHERE ${where} ORDER BY created_at, id LIMIT ? OFFSET ?`).all(...values, limit, offset);
    return { data: rows, meta: { limit, offset, total } };
  }
  function patch(table, body, where, values) {
    const changes = { ...body, updated_at: now() };
    db.prepare(`UPDATE ${table} SET ${Object.keys(changes).map(k => `${k} = ?`).join(', ')} WHERE ${where}`).run(...Object.values(changes), ...values);
  }
  return {
    health() { db.prepare('SELECT 1').get(); return wrap({ status: 'ok', database: 'ok' }); },
    async register({ body }) {
      const email = body.email.toLowerCase();
      const passwordHash = await hashPassword(body.password);
      return transaction(db, () => {
        if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw new ApiError(409, 'EMAIL_EXISTS', 'Email is already registered');
        const user = { id: randomUUID(), email, name: body.name.trim(), created_at: now() };
        db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?)').run(user.id, email, user.name, passwordHash, user.created_at);
        return wrap({ user, ...createSession(db, user.id) });
      });
    },
    async login({ body }) {
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(body.email.toLowerCase());
      // Perform scrypt even for unknown accounts to reduce account timing differences.
      const dummy = `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`;
      const valid = await verifyPassword(body.password, user?.password_hash || dummy);
      if (!user || !valid) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
      return wrap({ user: publicUser(user), ...createSession(db, user.id) });
    },
    logout({ sessionHash }) { db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sessionHash); },
    me({ user }) { return wrap(publicUser(user)); },
    listShops({ user, query }) {
      return page('shops', 'id IN (SELECT shop_id FROM shop_memberships WHERE user_id = ?)', [user.id], query);
    },
    createShop({ user, body }) {
      return transaction(db, () => {
        const id = randomUUID(), time = now();
        db.prepare('INSERT INTO shops VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, body.name.trim(), body.description || '', body.opening_hours || '', body.persona || '', time, time);
        db.prepare('INSERT INTO shop_memberships VALUES (?, ?, ?, ?)').run(id, user.id, 'owner', time);
        return wrap(db.prepare('SELECT * FROM shops WHERE id = ?').get(id));
      });
    },
    getShop({ params }) { return wrap(db.prepare('SELECT * FROM shops WHERE id = ?').get(params.shopId) || missing()); },
    updateShop({ params, body }) {
      patch('shops', body, 'id = ?', [params.shopId]);
      return this.getShop({ params });
    },
    listKnowledge({ params, query }) { return page('knowledge_entries', 'shop_id = ?', [params.shopId], query); },
    createKnowledge({ params, user, body }) {
      const id = randomUUID(), time = now();
      db.prepare('INSERT INTO knowledge_entries VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, params.shopId, body.kind, body.title, body.content, body.status, user.id, time, time);
      return wrap(get('knowledge_entries', params.shopId, id));
    },
    getKnowledge({ params }) { return wrap(get('knowledge_entries', params.shopId, params.knowledgeId)); },
    updateKnowledge({ params, body }) {
      get('knowledge_entries', params.shopId, params.knowledgeId);
      patch('knowledge_entries', body, 'shop_id = ? AND id = ?', [params.shopId, params.knowledgeId]);
      return this.getKnowledge({ params });
    },
    deleteKnowledge({ params }) {
      get('knowledge_entries', params.shopId, params.knowledgeId);
      db.prepare('DELETE FROM knowledge_entries WHERE shop_id = ? AND id = ?').run(params.shopId, params.knowledgeId);
    },
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
