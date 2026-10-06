import { randomUUID } from 'node:crypto';
import { transaction } from '../lib/db.js';
import { hashPassword, verifyPassword, createSession } from '../lib/auth.js';
import { ApiError } from '../utils/validation.js';
import { checkLineConnection, verifyLineSignature } from './line.js';
import { createLineWorker } from './worker.js';
import { recordLineEvents } from './lineJobs.js';
import { createLineSimulator } from './simulator.js';
import { countToNumber } from '../lib/postgresql-schema.js';

export const publicUser = user => ({ id: user.id, email: user.email, name: user.name, created_at: user.created_at });
const now = () => new Date().toISOString();
const missing = () => { throw new ApiError(404, 'NOT_FOUND', 'Resource not found'); };
const wrap = value => ({ data: value });

const maskSecret = val => (!val ? null : (val.length > 8 ? `${'*'.repeat(val.length - 4)}${val.slice(-4)}` : '****'));
const maskToken = val => (!val ? null : (val.length > 10 ? `${'*'.repeat(val.length - 6)}${val.slice(-6)}` : '******'));

export function createService(db, options = {}) {
  const worker = options.worker || createLineWorker(db, options.workerOptions);
  const simulator = createLineSimulator(db, options.workerOptions);
  const editable = {
    shops: ['name', 'description', 'opening_hours', 'persona'],
    knowledge_entries: ['kind', 'title', 'content', 'status'],
    conversations: ['status', 'bot_mode'],
    messages: [],
  };
  function checkTable(table) { if (!Object.hasOwn(editable, table)) throw new Error('Invalid internal table'); }
  const placeholders = (where, start = 0) => where.replaceAll('?', () => `$${++start}`);
  async function get(table, shopId, id, executor = db, lock = false) {
    checkTable(table);
    return (await executor.query(`SELECT * FROM ${table} WHERE shop_id = $1 AND id = $2${lock ? ' FOR UPDATE' : ''}`, [shopId, id])).rows[0] || missing();
  }
  async function page(table, where, values, query) {
    checkTable(table);
    where = placeholders(where);
    const { limit, offset } = query;
    const total = (await db.query(`SELECT count(*) AS n FROM ${table} WHERE ${where}`, [...values])).rows[0].n;
    const rows = (await db.query(`SELECT * FROM ${table} WHERE ${where} ORDER BY created_at, id LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, limit, offset])).rows;
    return { data: rows, meta: { limit, offset, total: countToNumber(total) } };
  }
  async function patch(table, body, where, values) {
    checkTable(table);
    if (Object.keys(body).some(key => !editable[table].includes(key))) throw new ApiError(422, 'VALIDATION_ERROR', 'Unsupported update field');
    const changes = { ...body, updated_at: now() };
    await db.query(`UPDATE ${table} SET ${Object.keys(changes).map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE ${placeholders(where, Object.keys(changes).length)}`, [...Object.values(changes), ...values]);
  }
  async function shopForUser(shopId, userId) {
    return (await db.query(`SELECT s.*, m.role AS member_role
      FROM shops s
      JOIN shop_memberships m ON m.shop_id = s.id
      WHERE s.id = $1 AND m.user_id = $2`, [shopId, userId])).rows[0] || missing();
  }
  return {
    async health() {
      try { await db.query('SELECT 1'); } catch { throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Database unavailable'); }
      return wrap({ status: 'ok', database: 'ok' });
    },
    async register({ body }) {
      const email = body.email.toLowerCase();
      const passwordHash = await hashPassword(body.password);
      try { return await transaction(db, async tx => {
        if ((await tx.query('SELECT 1 FROM users WHERE lower(email) = lower($1)', [email])).rows[0]) throw new ApiError(409, 'EMAIL_EXISTS', 'Email is already registered');
        const user = { id: randomUUID(), email, name: body.name.trim(), created_at: now() };
        await tx.query('INSERT INTO users (id,email,name,password_hash,created_at) VALUES ($1, $2, $3, $4, $5)', [user.id, email, user.name, passwordHash, user.created_at]);
        return wrap({ user, ...await createSession(tx, user.id) });
      }); } catch (error) {
        if (error.code === '23505' && error.constraint === 'users_email_lower_idx') throw new ApiError(409, 'EMAIL_EXISTS', 'Email is already registered');
        throw error;
      }
    },
    async login({ body }) {
      const user = (await db.query('SELECT * FROM users WHERE lower(email) = lower($1)', [body.email.toLowerCase()])).rows[0];
      // Perform scrypt even for unknown accounts to reduce account timing differences.
      const dummy = `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`;
      const valid = await verifyPassword(body.password, user?.password_hash || dummy);
      if (!user || !valid) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
      return wrap({ user: publicUser(user), ...await transaction(db, tx => createSession(tx, user.id)) });
    },
    async logout({ sessionHash }) { (await db.query('DELETE FROM sessions WHERE token_hash = $1', [sessionHash])); },
    async me({ user }) { return wrap(publicUser(user)); },
    async listShops({ user, query }) {
      const { limit, offset } = query;
      const total = (await db.query('SELECT count(*) AS n FROM shop_memberships WHERE user_id = $1', [user.id])).rows[0].n;
      const rows = (await db.query(`SELECT s.*, m.role AS member_role
        FROM shops s
        JOIN shop_memberships m ON m.shop_id = s.id
        WHERE m.user_id = $1
        ORDER BY s.created_at, s.id LIMIT $2 OFFSET $3`, [user.id, limit, offset])).rows;
      return { data: rows, meta: { limit, offset, total: countToNumber(total) } };
    },
    async createShop({ user, body }) {
      return transaction(db, async tx => {
        const id = randomUUID(), time = now();
        await tx.query('INSERT INTO shops (id,name,description,opening_hours,persona,created_at,updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)', [id, body.name.trim(), body.description || '', body.opening_hours || '', body.persona || '', time, time]);
        await tx.query('INSERT INTO shop_memberships (shop_id,user_id,role,created_at) VALUES ($1, $2, $3, $4)', [id, user.id, 'owner', time]);
        return wrap({ ...(await tx.query('SELECT * FROM shops WHERE id = $1', [id])).rows[0], member_role: 'owner' });
      });
    },
    async getShop({ params, user }) { return wrap(await shopForUser(params.shopId, user.id)); },
    async updateShop({ params, body, user }) {
      await patch('shops', body, 'id = ?', [params.shopId]);
      return this.getShop({ params, user });
    },
    async listKnowledge({ params, query }) { return page('knowledge_entries', 'shop_id = ?', [params.shopId], query); },
    async createKnowledge({ params, user, body }) {
      const id = randomUUID(), time = now();
      await db.query('INSERT INTO knowledge_entries (id,shop_id,kind,title,content,status,created_by,created_at,updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [id, params.shopId, body.kind, body.title, body.content, body.status, user.id, time, time]);
      return wrap(await get('knowledge_entries', params.shopId, id));
    },
    async getKnowledge({ params }) { return wrap(await get('knowledge_entries', params.shopId, params.knowledgeId)); },
    async updateKnowledge({ params, body }) {
      await get('knowledge_entries', params.shopId, params.knowledgeId);
      await patch('knowledge_entries', body, 'shop_id = ? AND id = ?', [params.shopId, params.knowledgeId]);
      return this.getKnowledge({ params });
    },
    async deleteKnowledge({ params }) {
      await get('knowledge_entries', params.shopId, params.knowledgeId);
      await db.query('DELETE FROM knowledge_entries WHERE shop_id = $1 AND id = $2', [params.shopId, params.knowledgeId]);
    },
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
    async getLineConfig({ params }) {
      if (!(await db.query('SELECT 1 FROM shops WHERE id = $1', [params.shopId])).rows[0]) missing();
      const channel = (await db.query('SELECT * FROM line_channels WHERE shop_id = $1', [params.shopId])).rows[0];
      return wrap({
        configured: Boolean(channel),
        channel_id: channel?.channel_id || null,
        channel_secret_masked: maskSecret(channel?.channel_secret),
        channel_access_token_masked: maskToken(channel?.channel_access_token),
        destination_user_id: channel?.destination_user_id || null,
        webhook_url: `/api/v1/shops/${params.shopId}/line/webhook`,
        updated_at: channel?.updated_at || null,
      });
    },
    async updateLineConfig({ params, body }) {
      await transaction(db, async tx => {
        // Lock the parent even when no channel exists yet; concurrent partial updates preserve credentials.
        if (!(await tx.query('SELECT 1 FROM shops WHERE id = $1 FOR UPDATE', [params.shopId])).rows[0]) missing();
        const time = now();
        const existing = (await tx.query('SELECT * FROM line_channels WHERE shop_id = $1', [params.shopId])).rows[0];
        const secret = body.channel_secret?.trim() || existing?.channel_secret;
        const token = body.channel_access_token?.trim() || existing?.channel_access_token;
        if (!secret || !token) throw new ApiError(422, 'VALIDATION_ERROR', 'Channel Secret and Channel Access Token are required');
        if (existing) {
          await tx.query(`UPDATE line_channels SET channel_secret = $1, channel_access_token = $2, channel_id = $3, destination_user_id = $4, updated_at = $5 WHERE shop_id = $6`, [secret, token, body.channel_id === undefined ? existing.channel_id : body.channel_id?.trim() || null, body.destination_user_id === undefined ? existing.destination_user_id : body.destination_user_id?.trim() || null, time, params.shopId]);
        } else {
          await tx.query(`INSERT INTO line_channels (shop_id,channel_id,channel_secret,channel_access_token,destination_user_id,created_at,updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [params.shopId, body.channel_id?.trim() || null, secret, token, body.destination_user_id?.trim() || null, time, time]);
        }
      });
      return this.getLineConfig({ params });
    },
    async verifyLineConnection({ params, body }) {
      const channel = (await db.query('SELECT * FROM line_channels WHERE shop_id = $1', [params.shopId])).rows[0];
      if (!channel) throw new ApiError(404, 'LINE_NOT_CONFIGURED', 'LINE channel is not configured for this shop');
      let url;
      try { url = new URL(body.webhook_url); } catch { /* Handled below. */ }
      if (!url || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash ||
          url.pathname !== `/api/v1/shops/${encodeURIComponent(params.shopId)}/line/webhook`) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'Invalid webhook URL for this shop');
      }
      return wrap(await checkLineConnection({
        channelAccessToken: channel.channel_access_token,
        expectedWebhookUrl: url.href,
        fetchImpl: options.lineFetch,
      }));
    },
    async lineWebhook({ params, body, rawBody, headers }) {
      const channel = (await db.query('SELECT * FROM line_channels WHERE shop_id = $1', [params.shopId])).rows[0];
      if (!channel) throw new ApiError(404, 'LINE_NOT_CONFIGURED', 'LINE channel is not configured for this shop');
      const signature = headers?.['x-line-signature'];
      if (!verifyLineSignature(rawBody, signature, channel.channel_secret)) {
        throw new ApiError(401, 'INVALID_SIGNATURE', 'Invalid LINE webhook signature');
      }
      if (channel.destination_user_id && body.destination && channel.destination_user_id !== body.destination) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'LINE destination does not match this shop');
      }
      const processedCount = await transaction(db, tx => recordLineEvents(tx, params.shopId, body.events || []));
      if (processedCount) worker.wake?.();
      return wrap({ status: 'ok', processed_count: processedCount });
    },
    async simulateLineMessage({ params, body }) {
      if (process.env.NODE_ENV === 'production') missing();
      if (!(await db.query('SELECT 1 FROM shops WHERE id = $1', [params.shopId])).rows[0]) missing();
      const channel = (await db.query('SELECT * FROM line_channels WHERE shop_id = $1', [params.shopId])).rows[0];
      const eventId = body.event_id || randomUUID();
      const inserted = await db.query('INSERT INTO line_events (event_id,shop_id,event_type,reply_token,status,created_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING event_id', [eventId, params.shopId, 'message', null, 'received', now()]);
      if (!inserted.rowCount) {
        const lastConv = (await db.query('SELECT id FROM conversations WHERE shop_id = $1 AND channel = $2 AND customer_external_id = $3 ORDER BY created_at DESC LIMIT 1', [params.shopId, 'line', body.user_id])).rows[0];
        return wrap({
          status: 'duplicate_ignored',
          conversation_id: lastConv?.id || 'duplicate',
          customer_message_id: 'duplicate',
          replied: false,
          reply_message_id: null,
          reply_text: null,
        });
      }
      const event = {
        type: 'message',
        webhookEventId: eventId,
        source: { type: 'user', userId: body.user_id },
        message: { type: 'text', id: randomUUID(), text: body.text },
        replyToken: null,
        timestamp: Date.now(),
      };
      const result = await simulator.handleMessageEvent({ shopId: params.shopId, event, channelConfig: channel, simulated: true });
      return wrap({
        status: 'processed',
        conversation_id: result.conversationId,
        customer_message_id: result.customerMsgId,
        replied: result.replied,
        reply_message_id: result.replyMsgId || null,
        reply_text: result.replyText || null,
      });
    },
    worker,
  };
}
