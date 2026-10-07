import { randomUUID } from 'node:crypto';
import { sendLineReply } from './line.js';
import { answerQuestion } from './rag.js';
import { createHttpRagGenerator } from './ragGenerator.js';

const now = () => new Date().toISOString();

export function createLineWorker(db, options = {}) {
  const replySender = options.sendReply || sendLineReply;
  const generator = options.generator ?? createHttpRagGenerator({
    url: process.env.RAG_GENERATOR_URL,
    token: process.env.RAG_GENERATOR_TOKEN,
    fetchImpl: options.fetchImpl,
  });
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

  async function handleMessageEvent({ shopId, event, channelConfig, simulated = false }) {
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
    const answer = await answerQuestion(db, { shopId, query: messageText, generator });
    const replyText = answer.text;

    // A human may take over while retrieval or generation is in progress.
    const latest = db.prepare('SELECT status, bot_mode FROM conversations WHERE shop_id = ? AND id = ?')
      .get(shopId, conversation.id);
    if (!latest || latest.status !== 'open' || latest.bot_mode !== 'active') {
      if (event.webhookEventId) {
        db.prepare("UPDATE line_events SET status = 'completed' WHERE event_id = ? AND shop_id = ?")
          .run(event.webhookEventId, shopId);
      }
      return { conversationId: conversation.id, customerMsgId, replied: false, reason: latest?.bot_mode || 'closed' };
    }

    // 5. ส่งข้อความกลับผ่าน LINE Messaging API
    let sendSuccess = simulated;
    if (!simulated && event.replyToken && channelConfig?.channel_access_token) {
      try {
        await replySender({
          channelAccessToken: channelConfig.channel_access_token,
          replyToken: event.replyToken,
          messages: [{ type: 'text', text: replyText }],
          fetchImpl: options.fetchImpl,
        });
        sendSuccess = true;
      } catch (err) {
        sendSuccess = false;
        if (options.logErrors !== false) {
          console.warn('Failed to send LINE reply:', err.message);
        }
      }
    }

    // Don't show an undelivered live reply as if the customer received it.
    if (db.open === false) {
      return { conversationId: conversation.id, customerMsgId, replied: sendSuccess };
    }
    if (!sendSuccess) {
      if (event.webhookEventId) {
        db.prepare(`UPDATE line_events SET status = 'failed' WHERE event_id = ?`).run(event.webhookEventId);
      }
      return { conversationId: conversation.id, customerMsgId, replied: false };
    }
    // 6. จัดเก็บข้อความฝั่งผู้ช่วย role: 'assistant'
    const replyMsgId = randomUUID();
    const replyTime = now();
    db.prepare(
      `INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(replyMsgId, shopId, conversation.id, 'assistant', replyText, null, replyTime);
    const saveSource = db.prepare(`INSERT INTO message_sources
      (shop_id, message_id, knowledge_entry_id, chunk_id, source_excerpt) VALUES (?, ?, ?, ?, ?)`);
    for (const source of answer.sources) {
      saveSource.run(shopId, replyMsgId, source.knowledge_entry_id, source.chunk_id,
        answer.method === 'faq' ? replyText : source.content);
    }
    db.prepare(`UPDATE conversations SET updated_at = ? WHERE shop_id = ? AND id = ?`).run(replyTime, shopId, conversation.id);

    // 7. อัปเดตสถานะ event
    if (event.webhookEventId) {
      db.prepare(`UPDATE line_events SET status = ? WHERE event_id = ?`).run(
        'completed',
        event.webhookEventId
      );
    }

    return {
      conversationId: conversation.id,
      customerMsgId,
      replyMsgId,
      replyText,
      replyMethod: answer.method,
      sourceKnowledgeIds: [...new Set(answer.sources.map(source => source.knowledge_entry_id))],
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
