import { createBuddyShareGeminiProvider, createGeminiProvider } from '../src/services/aiProviders.js';

const provider = process.env.BUDDYSHARE_API_KEY
  ? createBuddyShareGeminiProvider({ apiKey: process.env.BUDDYSHARE_API_KEY,
    model: process.env.BUDDYSHARE_MODEL || undefined })
  : createGeminiProvider({ apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || undefined });

if (!provider) {
  console.error('Primary AI key is not configured in .env');
  process.exitCode = 2;
} else {
  try {
    // ใช้ข้อมูลสมมติเท่านั้น เพื่อตรวจคีย์และรูปแบบคำตอบโดยไม่ส่งข้อมูลร้าน
    const context = [{ chunkId: 'local-check:0', content: 'BLUE' }];
    const result = await provider.generate({
      context,
      prompt: { messages: [
        { role: 'system', content: 'Return JSON with text exactly BLUE, sourceChunkIds ["local-check:0"], and insufficient false.' },
        { role: 'user', content: 'The evidence is BLUE. Return the required JSON answer.' },
      ] },
    }, AbortSignal.timeout(15000));
    if (result.text !== 'BLUE' || result.sourceChunkIds?.[0] !== 'local-check:0') {
      throw new Error('AI_UNEXPECTED_RESULT');
    }
    console.log(`Primary AI check passed (${provider.name}, ${provider.model})`);
  } catch (error) {
    console.error(`Primary AI check failed (${error.code || error.name || 'AI_ERROR'})`);
    process.exitCode = 1;
  }
}
