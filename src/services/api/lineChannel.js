import { randomUUID } from 'node:crypto';
import { ApiError } from '../../utils/validation.js';
import { checkLineConnection, verifyLineSignature } from '../line.js';
import { now, missing, wrap } from './common.js';

const maskSecret = val => (!val ? null : (val.length > 8 ? `${'*'.repeat(val.length - 4)}${val.slice(-4)}` : '****'));
const maskToken = val => (!val ? null : (val.length > 10 ? `${'*'.repeat(val.length - 6)}${val.slice(-6)}` : '******'));

// รวมคำสั่ง API ที่เกี่ยวกับ lineChannel ไว้ในไฟล์เดียว
export function createLineChannelOperations(db, worker, options) {
  return {
    getLineConfig({ params }) {
      if (!db.prepare('SELECT 1 FROM shops WHERE id = ?').get(params.shopId)) missing();
      const channel = db.prepare('SELECT * FROM line_channels WHERE shop_id = ?').get(params.shopId);
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
    updateLineConfig({ params, body }) {
      if (!db.prepare('SELECT 1 FROM shops WHERE id = ?').get(params.shopId)) missing();
      const time = now();
      const existing = db.prepare('SELECT * FROM line_channels WHERE shop_id = ?').get(params.shopId);
      const secret = body.channel_secret?.trim() || existing?.channel_secret;
      const token = body.channel_access_token?.trim() || existing?.channel_access_token;
      if (!secret || !token) throw new ApiError(422, 'VALIDATION_ERROR', 'Channel Secret and Channel Access Token are required');
      if (existing) {
        db.prepare(`UPDATE line_channels SET channel_secret = ?, channel_access_token = ?, channel_id = ?, destination_user_id = ?, updated_at = ? WHERE shop_id = ?`)
          .run(secret, token, body.channel_id === undefined ? existing.channel_id : body.channel_id?.trim() || null, body.destination_user_id === undefined ? existing.destination_user_id : body.destination_user_id?.trim() || null, time, params.shopId);
      } else {
        db.prepare(`INSERT INTO line_channels VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .run(params.shopId, body.channel_id?.trim() || null, secret, token, body.destination_user_id?.trim() || null, time, time);
      }
      return this.getLineConfig({ params });
    },
    async verifyLineConnection({ params, body }) {
      const channel = db.prepare('SELECT * FROM line_channels WHERE shop_id = ?').get(params.shopId);
      if (!channel) throw new ApiError(404, 'LINE_NOT_CONFIGURED', 'LINE channel is not configured for this shop');
      let url;
      try { url = new URL(body.webhook_url); } catch { /* ตรวจ URL ที่ไม่ถูกต้องในเงื่อนไขถัดไป */ }
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
    lineWebhook({ params, body, rawBody, headers }) {
      const channel = db.prepare('SELECT * FROM line_channels WHERE shop_id = ?').get(params.shopId);
      if (!channel) throw new ApiError(404, 'LINE_NOT_CONFIGURED', 'LINE channel is not configured for this shop');
      const signature = headers?.['x-line-signature'];
      if (!verifyLineSignature(rawBody, signature, channel.channel_secret)) {
        throw new ApiError(401, 'INVALID_SIGNATURE', 'Invalid LINE webhook signature');
      }
      const events = body.events || [];
      let processedCount = 0;
      for (const event of events) {
        const eventId = event.webhookEventId || event.message?.id;
        if (eventId) {
          const existing = db.prepare('SELECT 1 FROM line_events WHERE event_id = ?').get(eventId);
          if (existing) continue;
          db.prepare('INSERT INTO line_events VALUES (?, ?, ?, ?, ?, ?)').run(eventId, params.shopId, event.type || 'unknown', event.replyToken || null, 'received', now());
        }
        if (event.type === 'message' && event.message?.type === 'text') {
          processedCount++;
          worker.enqueue(() => worker.handleMessageEvent({ shopId: params.shopId, event, channelConfig: channel }));
        }
      }
      return wrap({ status: 'ok', processed_count: processedCount });
    },
    async simulateLineMessage({ params, body }) {
      if (!db.prepare('SELECT 1 FROM shops WHERE id = ?').get(params.shopId)) missing();
      const channel = db.prepare('SELECT * FROM line_channels WHERE shop_id = ?').get(params.shopId);
      const eventId = body.event_id || randomUUID();
      const existing = db.prepare('SELECT 1 FROM line_events WHERE event_id = ?').get(eventId);
      if (existing) {
        const lastConv = db.prepare('SELECT id FROM conversations WHERE shop_id = ? AND channel = ? AND customer_external_id = ? ORDER BY created_at DESC LIMIT 1').get(params.shopId, 'line', body.user_id);
        return wrap({
          status: 'duplicate_ignored',
          conversation_id: lastConv?.id || 'duplicate',
          customer_message_id: 'duplicate',
          replied: false,
          reply_message_id: null,
          reply_text: null,
          reply_method: null,
          reply_source_ids: [],
        });
      }
      const time = now();
      db.prepare('INSERT INTO line_events VALUES (?, ?, ?, ?, ?, ?)').run(eventId, params.shopId, 'message', null, 'received', time);
      const event = {
        type: 'message',
        webhookEventId: eventId,
        source: { type: 'user', userId: body.user_id },
        message: { type: 'text', id: randomUUID(), text: body.text },
        replyToken: null,
        timestamp: Date.now(),
      };
      const result = await worker.handleMessageEvent({ shopId: params.shopId, event, channelConfig: channel, simulated: true });
      return wrap({
        status: 'processed',
        conversation_id: result.conversationId,
        customer_message_id: result.customerMsgId,
        replied: result.replied,
        reply_message_id: result.replyMsgId || null,
        reply_text: result.replyText || null,
        reply_method: result.replyMethod || null,
        reply_source_ids: result.sourceKnowledgeIds || [],
      });
    },
  };
}
