export function handoverAnswer(reason) {
  return { method: 'handover', sources: [], handoverReason: reason,
    text: reason === 'AI_SAFETY_REFUSAL'
      ? 'ขออภัย ระบบไม่สามารถตอบคำถามนี้ได้ ขณะนี้ส่งเรื่องให้เจ้าหน้าที่ดูแลต่อแล้ว'
      : 'ขออภัย ระบบตอบอัตโนมัติขัดข้อง ขณะนี้ส่งเรื่องให้เจ้าหน้าที่ดูแลต่อแล้ว' };
}

// Caller holds the conversation row lock; concurrent jobs cannot claim the same handover.
export async function claimHandover(tx, { shopId, conversationId, ownerId, reason }) {
  const result = await tx.query(`UPDATE conversations SET bot_mode='human',handover_reason=$4,
    handover_job_id=$3,updated_at=clock_timestamp()
    WHERE shop_id=$1 AND id=$2 AND status='open' AND bot_mode='active' RETURNING id`,
  [shopId, conversationId, ownerId, reason]);
  return result.rowCount === 1;
}

export function maySendReply(conversation, { method, ownerId }) {
  if (!conversation || conversation.status !== 'open') return false;
  if (method === 'handover') return conversation.bot_mode === 'human' && conversation.handover_job_id === ownerId;
  return conversation.bot_mode === 'active';
}
