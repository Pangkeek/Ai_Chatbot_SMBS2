import { now, wrap } from './common.js';
import { countToNumber } from '../../lib/postgresql-schema.js';

export function createStatisticsOperations(db) {
  return {
    async getShopStatistics({ params }) {
      // นับแยกตารางใน SQL เดียว เพื่อไม่ให้จำนวนข้อความคูณจำนวนห้องจาก JOIN
      const { rows: [counts] } = await db.query(`SELECT c.*, m.* FROM (
        SELECT count(*) AS total_conversations,
          count(CASE WHEN status = 'open' THEN 1 END) AS open_conversations,
          count(CASE WHEN status = 'closed' THEN 1 END) AS closed_conversations,
          count(CASE WHEN bot_mode = 'active' THEN 1 END) AS active_conversations,
          count(CASE WHEN bot_mode = 'paused' THEN 1 END) AS paused_conversations,
          count(CASE WHEN bot_mode = 'human' THEN 1 END) AS human_conversations,
          count(CASE WHEN channel = 'line' THEN 1 END) AS line_conversations,
          count(CASE WHEN channel = 'web' THEN 1 END) AS web_conversations
        FROM conversations WHERE shop_id = $1
      ) c CROSS JOIN (
        SELECT count(*) AS total_messages,
          count(CASE WHEN role = 'customer' THEN 1 END) AS customer_messages,
          count(CASE WHEN role = 'assistant' THEN 1 END) AS assistant_messages,
          count(CASE WHEN role = 'agent' THEN 1 END) AS agent_messages,
          count(CASE WHEN role = 'system' THEN 1 END) AS system_messages
        FROM messages WHERE shop_id = $1
      ) m`, [params.shopId]);
      // pg ส่ง count(*) เป็น int8/string จึงตรวจขอบเขตก่อนแปลงให้ตรง API schema
      const numbers = Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, countToNumber(value)]));
      return wrap({ ...numbers, generated_at: now() });
    },
  };
}
