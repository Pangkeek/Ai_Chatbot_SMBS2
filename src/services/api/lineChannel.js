import { randomUUID } from 'node:crypto';
import { transaction } from '../../lib/db.js';
import { ApiError } from '../../utils/validation.js';
import { checkLineConnection, verifyLineSignature } from '../line.js';
import { recordLineEvents } from '../lineJobs.js';
import { createLineSimulator } from '../simulator.js';

import { now, missing, wrap } from './common.js';

const maskSecret = val => (!val ? null : (val.length > 8 ? `${'*'.repeat(val.length - 4)}${val.slice(-4)}` : '****'));
const maskToken = val => (!val ? null : (val.length > 10 ? `${'*'.repeat(val.length - 6)}${val.slice(-6)}` : '******'));

export function createLineChannelOperations(db, worker, options = {}) {
  const simulator = createLineSimulator(db, options.workerOptions);
  return {
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
          reply_method: null, reply_source_ids: [],
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
        reply_method: result.replyMethod || null, reply_source_ids: result.sourceKnowledgeIds || [],
      });
    },
  };
}
