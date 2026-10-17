import { randomUUID } from 'node:crypto';
import { transaction } from '../../lib/db.js';
import { ApiError } from '../../utils/validation.js';
import { sendLinePush } from '../line.js';
import { wrap } from './common.js';

// หลัง process หยุดระหว่างส่ง ห้ามลองส่งซ้ำโดยอัตโนมัติ เพราะ LINE อาจรับไปแล้ว
export const recoverAgentDeliveries = (tx, shopId, conversationId) => tx.query(`UPDATE agent_deliveries
  SET status='unknown',updated_at=clock_timestamp() WHERE shop_id=$1 AND conversation_id=$2
  AND status='sending' AND created_at<clock_timestamp()-interval '30 seconds'`, [shopId, conversationId]);

export function createAgentRepliesOperations(db, { get }, options = {}) {
  return {
    async listAgentReplies({ params }) {
      await get('conversations', params.shopId, params.conversationId);
      await recoverAgentDeliveries(db, params.shopId, params.conversationId);
      return wrap((await db.query(`SELECT * FROM agent_deliveries WHERE shop_id=$1 AND conversation_id=$2
        ORDER BY created_at DESC,id DESC LIMIT 20`, [params.shopId, params.conversationId])).rows);
    },
    async sendAgentReply({ params, body, user }) {
      const { shopId, conversationId } = params;
      const claimed = await transaction(db, async tx => {
        const room = await get('conversations', shopId, conversationId, tx, true);
        await recoverAgentDeliveries(tx, shopId, conversationId);
        const previous = (await tx.query('SELECT * FROM agent_deliveries WHERE shop_id=$1 AND conversation_id=$2 AND request_id=$3', [shopId, conversationId, body.request_id])).rows[0];
        if (previous) {
          if (previous.content !== body.content) throw new ApiError(409, 'REQUEST_CONFLICT', 'Request ID was already used with different content');
          return { previous };
        }
        if (room.status !== 'open') throw new ApiError(409, 'CONVERSATION_CLOSED', 'Reopen the conversation before replying');
        if (room.bot_mode === 'active') throw new ApiError(409, 'BOT_ACTIVE', 'Pause or take over before replying');
        if (room.channel !== 'line') throw new ApiError(409, 'CHANNEL_UNSUPPORTED', 'External replies require a LINE conversation');
        const pending = await tx.query("SELECT 1 FROM agent_deliveries WHERE shop_id=$1 AND conversation_id=$2 AND status='sending'", [shopId, conversationId]);
        if (pending.rowCount) throw new ApiError(409, 'DELIVERY_IN_PROGRESS', 'Wait for the current message to finish sending');
        const channel = (await tx.query('SELECT channel_access_token FROM line_channels WHERE shop_id=$1', [shopId])).rows[0];
        if (!channel?.channel_access_token) throw new ApiError(409, 'LINE_NOT_CONFIGURED', 'Configure the shop LINE channel before replying');
        const delivery = (await tx.query(`INSERT INTO agent_deliveries(id,shop_id,conversation_id,request_id,content,author_user_id,status)
          VALUES($1,$2,$3,$4,$5,$6,'sending') RETURNING *`, [randomUUID(), shopId, conversationId, body.request_id, body.content, user.id])).rows[0];
        return { delivery, channel, room };
      });
      if (claimed.previous) return wrap(claimed.previous);
      const { delivery, channel, room } = claimed;
      let status = 'sent', timeout;
      const controller = new AbortController();
      try {
        await Promise.race([
          (options.sendPush || sendLinePush)({ channelAccessToken: channel.channel_access_token,
            to: room.customer_external_id, messages: [{ type: 'text', text: body.content }],
            retryKey: delivery.id, signal: controller.signal, fetchImpl: options.lineFetch }),
          new Promise((_, reject) => { timeout = setTimeout(() => { controller.abort(); reject(new Error('LINE timeout')); }, 10000); }),
        ]);
      } catch (error) {
        status = error.code === 'LINE_HTTP_REJECTED' && error.statusCode < 500 ? 'failed' : 'unknown';
      } finally { clearTimeout(timeout); }
      return transaction(db, async tx => {
        await get('conversations', shopId, conversationId, tx, true);
        // ผลที่กลับมาช้าหลังถูก recover ต้องไม่เปลี่ยน unknown เป็นส่งสำเร็จ
        const current = (await tx.query('SELECT * FROM agent_deliveries WHERE id=$1 FOR UPDATE', [delivery.id])).rows[0];
        if (current.status !== 'sending') return wrap(current);
        let messageId = null;
        if (status === 'sent') {
          messageId = delivery.id;
          await tx.query(`INSERT INTO messages(id,shop_id,conversation_id,role,content,author_user_id,created_at)
            VALUES($1,$2,$3,'agent',$4,$5,clock_timestamp())`, [messageId, shopId, conversationId, body.content, user.id]);
          await tx.query('UPDATE conversations SET updated_at=clock_timestamp() WHERE shop_id=$1 AND id=$2', [shopId, conversationId]);
        }
        return wrap((await tx.query('UPDATE agent_deliveries SET status=$2,message_id=$3,updated_at=clock_timestamp() WHERE id=$1 RETURNING *', [delivery.id, status, messageId])).rows[0]);
      });
    },
  };
}
