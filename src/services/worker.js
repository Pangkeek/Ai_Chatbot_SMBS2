import { randomUUID } from 'node:crypto';
import { generateDefaultReply, sendLineReply } from './line.js';

const now = () => new Date().toISOString();

export function createLineWorker(db, options = {}) {
  const replySender = options.sendReply || sendLineReply;
  const queue = [];
  let isProcessing = false;

  async  function processNext() {
    if (isProcessing || queue.length === 0) return;
    if (db.open === false) return;
    isProcessing = true;
    const task = queue.shift();
    setImmediate(async () => {
      try {
        if (db.open !== false) {
          await task();
        }
      } catch (err) {
        if (err.code !== 'ERR_INVALID_STATE' && db.open !== false && options.logErrors !== false) {
          console.error('Worker task error:', err);
        }
      } finally {
        isProcessing = false;
        processNext();
      }
    });
  }

  function enqueue(task) {
    queue.push(task);
    setImmediate(processNext);
  }

  async function handleMessageEvent({ shopId, event, channelConfig }) {
    const userId = event.source?.userId || 'unknown-line-user';
    const messageText = event.message?.text || '';
    const customerName = `LINE User ${userId.length > 4 ? userId.slice(-4) : userId}`;

    // 1. ค้นหาหรือสร้าง Conversation ของ LINE User ในร้านนั้น
    let conversation = db.prepare(
      `SELECT * FROM conversations 
       WHERE shop_id = ? AND channel = 'line' AND customer_external_id = ? AND status = 'open' 
       ORDER BY created_at DESC LIMIT 1`
    ).get(shopId, userId);

    const currentTime = now();
    if (!conversation) {
      const conversationId = randomUUID();
      db.prepare(
        `INSERT INTO conversations VALUES (?, ?, 'line', ?, ?, 'open', 'active', ?, ?)`
      ).run(conversationId, shopId, userId, customerName, currentTime, currentTime);
      conversation = {
        id: conversationId,
        shop_id: shopId,
        channel: 'line',
        customer_external_id: userId,
        customer_name: customerName,
        status: 'open',
        bot_mode: 'active',
      };
    }

    // 2. จัดเก็บข้อความฝั่งลูกค้า role: 'customer'
    const customerMsgId = randomUUID();
    db.prepare(
      `INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(customerMsgId, shopId, conversation.id, 'customer', messageText, null, currentTime);
    db.prepare(`UPDATE conversations SET updated_at = ? WHERE shop_id = ? AND id = ?`).run(currentTime, shopId, conversation.id);

    // 3. ตรวจสอบสถานะ bot_mode (ถ้าเป็น 'paused' หรือ 'human' ห้ามส่งบอทตอบกลับ)
    if (conversation.status !== 'open' || conversation.bot_mode !== 'active') {
      if (event.webhookEventId) {
        db.prepare(`UPDATE line_events SET status = 'completed' WHERE event_id = ?`).run(event.webhookEventId);
      }
      return {
        conversationId: conversation.id,
        customerMsgId,
        replied: false,
        reason: conversation.bot_mode,
      };
    }

    // 4. บอทอยู่ในโหมด 'active': สร้างข้อความตอบกลับ
    const shop = db.prepare('SELECT * FROM shops WHERE id = ?').get(shopId);
    const replyText = options.generateReply
      ? options.generateReply({ shop, conversation, messageText })
      : generateDefaultReply({ shop, messageText });

    // 5. ส่งข้อความกลับผ่าน LINE Messaging API
    let sendSuccess = true;
    if (event.replyToken && channelConfig?.channel_access_token) {
      try {
        await replySender({
          channelAccessToken: channelConfig.channel_access_token,
          replyToken: event.replyToken,
          messages: [{ type: 'text', text: replyText }],
          fetchImpl: options.fetchImpl,
        });
      } catch (err) {
        sendSuccess = false;
        if (options.logErrors !== false) {
          console.warn('Failed to send LINE reply:', err.message);
        }
      }
    }

    // 6. จัดเก็บข้อความฝั่งผู้ช่วย role: 'assistant'
    if (db.open === false) {
      return { conversationId: conversation.id, customerMsgId, replied: sendSuccess };
    }
    const replyMsgId = randomUUID();
    const replyTime = now();
    db.prepare(
      `INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(replyMsgId, shopId, conversation.id, 'assistant', replyText, null, replyTime);
    db.prepare(`UPDATE conversations SET updated_at = ? WHERE shop_id = ? AND id = ?`).run(replyTime, shopId, conversation.id);

    // 7. อัปเดตสถานะ event
    if (event.webhookEventId) {
      db.prepare(`UPDATE line_events SET status = ? WHERE event_id = ?`).run(
        sendSuccess ? 'completed' : 'failed',
        event.webhookEventId
      );
    }

    return {
      conversationId: conversation.id,
      customerMsgId,
      replyMsgId,
      replyText,
      replied: true,
    };
  }

  async function drain() {
    while (queue.length > 0 || isProcessing) {
      await new Promise(resolve => setTimeout(resolve, 5));
    }
  }

  return {
    enqueue,
    handleMessageEvent,
    getPendingCount: () => queue.length,
    drain,
  };
}
