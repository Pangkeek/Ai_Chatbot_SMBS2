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

export async function checkLineConnection({ channelAccessToken, expectedWebhookUrl, fetchImpl = fetch }) {
  const result = {
    status: 'line_unavailable',
    token_valid: null,
    bot_display_name: null,
    line_webhook_url: null,
    webhook_active: false,
    webhook_reachable: false,
    checked_at: new Date().toISOString(),
  };
  const headers = { Authorization: `Bearer ${channelAccessToken}` };
  try {
    const botResponse = await fetchImpl('https://api.line.me/v2/bot/info', {
      headers,
      signal: AbortSignal.timeout(8000),
    });
    if (botResponse.status === 401 || botResponse.status === 403) {
      return { ...result, status: 'token_invalid', token_valid: false };
    }
    if (!botResponse.ok) return result;
    const bot = await botResponse.json();
    result.token_valid = true;
    result.bot_display_name = bot.displayName || null;

    const endpointResponse = await fetchImpl('https://api.line.me/v2/bot/channel/webhook/endpoint', {
      headers,
      signal: AbortSignal.timeout(8000),
    });
    if (endpointResponse.status === 404) return { ...result, status: 'webhook_not_configured' };
    if (!endpointResponse.ok) return result;
    const endpoint = await endpointResponse.json();
    result.line_webhook_url = endpoint.endpoint || null;
    result.webhook_active = endpoint.active === true;
    if (!result.line_webhook_url) return { ...result, status: 'webhook_not_configured' };
    if (result.line_webhook_url !== expectedWebhookUrl) return { ...result, status: 'webhook_mismatch' };
    if (!result.webhook_active) return { ...result, status: 'webhook_inactive' };
    if (!expectedWebhookUrl.startsWith('https://')) return { ...result, status: 'webhook_not_public' };

    const testResponse = await fetchImpl('https://api.line.me/v2/bot/channel/webhook/test', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(10000),
    });
    if (!testResponse.ok) return result;
    const test = await testResponse.json();
    result.webhook_reachable = test.success === true;
    return { ...result, status: result.webhook_reachable ? 'connected' : 'webhook_failed' };
  } catch {
    return result;
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
