import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyLineSignature(rawBody, signature, channelSecret) {
  if (!signature || !channelSecret || rawBody === undefined || rawBody === null) return false;
  try {
    const rawBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
    const computed = createHmac('sha256', channelSecret).update(rawBuffer).digest('base64');
    const signatureBuffer = Buffer.from(signature, 'utf8');
    const computedBuffer = Buffer.from(computed, 'utf8');
    if (signatureBuffer.length !== computedBuffer.length) return false;
    return timingSafeEqual(signatureBuffer, computedBuffer);
  } catch {
    return false;
  }
}

export async function sendLineReply({ channelAccessToken, replyToken, messages, fetchImpl = fetch }) {
  if (!channelAccessToken || !replyToken || !messages?.length) {
    throw new Error('Missing parameters for LINE reply');
  }
  const response = await fetchImpl('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LINE API error (${response.status}): ${text}`);
  }
  return { status: 'ok', statusCode: response.status };
}

export async function sendLinePush({ channelAccessToken, to, messages, fetchImpl = fetch }) {
  if (!channelAccessToken || !to || !messages?.length) {
    throw new Error('Missing parameters for LINE push');
  }
  const response = await fetchImpl('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({ to, messages }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LINE API error (${response.status}): ${text}`);
  }
  return { status: 'ok', statusCode: response.status };
}

export function generateDefaultReply({ shop, messageText }) {
  const shopName = shop?.name || 'ทางร้าน';
  const hours = shop?.opening_hours ? ` (เวลาทำการ: ${shop.opening_hours})` : '';
  return `ขอบคุณที่ติดต่อร้าน ${shopName}${hours} ครับ ได้รับข้อความ "${messageText}" เรียบร้อยแล้ว ขณะนี้ระบบกำลังเชื่อมต่อข้อมูลร้านเพื่อให้บริการครับ`;
}
