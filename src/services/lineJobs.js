import { createHash, randomUUID } from 'node:crypto';
import { ApiError } from '../utils/validation.js';

export const messageId = (shopId, eventId, role) => `line-${createHash('sha256').update(JSON.stringify([shopId, eventId, role])).digest('hex')}`;

// Allowlist only the fields used by the consumer. Never persist channel credentials.
export function jobPayload(event) {
  return { source: { userId: event.source.userId }, message: { text: event.message.text }, replyToken: event.replyToken || null };
}

export async function recordLineEvents(tx, shopId, events) {
  let count = 0;
  for (const event of events) {
    const text = event.type === 'message' && event.message?.type === 'text';
    const eventId = event.webhookEventId || event.message?.id;
    if (!eventId?.trim()) throw new ApiError(422, 'VALIDATION_ERROR', 'LINE event requires an event ID');
    if (text && (!eventId?.trim() || !event.source?.userId?.trim() || !event.message.text?.trim())) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Text event requires an event ID, user ID and text');
    }
    const inserted = await tx.query(`INSERT INTO line_events (event_id,shop_id,event_type,reply_token,status,created_at)
      VALUES ($1,$2,$3,$4,$5,clock_timestamp()) ON CONFLICT DO NOTHING RETURNING event_id`,
    [eventId, shopId, event.type || 'unknown', event.replyToken || null, text ? 'received' : 'ignored']);
    if (!inserted.rowCount) {
      const sameShop = (await tx.query('SELECT 1 FROM line_events WHERE event_id=$1 AND shop_id=$2', [eventId, shopId])).rowCount;
      if (!sameShop) throw new ApiError(409, 'LINE_EVENT_COLLISION', 'LINE event ID is already in use');
      continue;
    }
    if (text) {
      await tx.query(`INSERT INTO line_jobs (job_id,shop_id,event_id,payload,received_at,available_at,created_at,updated_at)
        VALUES ($1,$2,$3,$4,clock_timestamp(),clock_timestamp(),clock_timestamp(),clock_timestamp())`,
      [randomUUID(), shopId, eventId, jobPayload(event)]);
      count++;
    }
  }
  return count;
}
