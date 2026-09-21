import { hashPassword } from './auth.js';
import { transaction } from './db.js';

export const demoPassword = 'DemoPass!2026';
export const demoShops = [
  { id: 'shop-coffee', userId: 'user-coffee', email: 'coffee@example.test', owner: 'เจ้าของบ้านกาแฟ', name: 'บ้านกาแฟ', description: 'ร้านกาแฟและเบเกอรี ข้อมูลสมมติสำหรับพัฒนา', hours: 'ทุกวัน 08:00-18:00', persona: 'ตอบสุภาพ กระชับ เป็นกันเอง',
    knowledge: [
      ['faq', 'เวลาเปิดร้าน', 'ร้านบ้านกาแฟเปิดทุกวัน 08:00-18:00'],
      ['product', 'เมนูแนะนำ', 'อเมริกาโนเย็น 60 บาท ลาเต้เย็น 75 บาท ครัวซองต์ 85 บาท'],
      ['policy', 'การจัดส่ง', 'รับสินค้าที่ร้านเท่านั้น ยังไม่มีบริการจัดส่ง'],
    ], question: 'ร้านเปิดกี่โมงครับ', answer: 'บ้านกาแฟเปิดทุกวัน 08:00-18:00 ค่ะ' },
  { id: 'shop-flower', userId: 'user-flower', email: 'flower@example.test', owner: 'เจ้าของบ้านดอกไม้', name: 'บ้านดอกไม้', description: 'ร้านดอกไม้และของขวัญ ข้อมูลสมมติสำหรับพัฒนา', hours: 'จันทร์-เสาร์ 09:00-19:00 ปิดวันอาทิตย์', persona: 'ตอบอบอุ่น แนะนำสินค้าโดยอ้างอิงข้อมูลร้าน',
    knowledge: [
      ['faq', 'เวลาเปิดร้าน', 'ร้านบ้านดอกไม้เปิดจันทร์-เสาร์ 09:00-19:00 และปิดวันอาทิตย์'],
      ['product', 'ช่อดอกไม้', 'ช่อกุหลาบเริ่มต้น 590 บาท ช่อดอกไม้รวมเริ่มต้น 390 บาท'],
      ['policy', 'การจัดส่ง', 'จัดส่งภายในเมือง ค่าจัดส่ง 50 บาท กรุณาสั่งล่วงหน้า 1 วัน'],
    ], question: 'ส่งดอกไม้ได้ไหมคะ', answer: 'จัดส่งภายในเมือง 50 บาท กรุณาสั่งล่วงหน้า 1 วันค่ะ' },
];

// Explicitly invoked only. Existing records are preserved when this is run again.
export async function seedDemo(db) {
  const hashes = await Promise.all(demoShops.map(() => hashPassword(demoPassword)));
  transaction(db, () => {
    for (const [index, shop] of demoShops.entries()) {
      const collision = db.prepare('SELECT id FROM users WHERE email = ?').get(shop.email);
      if (collision && collision.id !== shop.userId) throw new Error(`Demo email already belongs to another user: ${shop.email}`);
      const time = '2026-09-01T00:00:00.000Z';
      db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING').run(shop.userId, shop.email, shop.owner, hashes[index], time);
      db.prepare('INSERT INTO shops VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING').run(shop.id, shop.name, shop.description, shop.hours, shop.persona, time, time);
      db.prepare('INSERT INTO shop_memberships VALUES (?, ?, ?, ?) ON CONFLICT(shop_id, user_id) DO NOTHING').run(shop.id, shop.userId, 'owner', time);
      shop.knowledge.forEach(([kind, title, content], entryIndex) => {
        db.prepare('INSERT INTO knowledge_entries VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING').run(`${shop.id}-kb-${entryIndex + 1}`, shop.id, kind, title, content, 'published', shop.userId, time, time);
      });
      const conversationId = `${shop.id}-conversation-1`;
      db.prepare('INSERT INTO conversations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING').run(conversationId, shop.id, 'web', 'demo-customer-1', 'ลูกค้าทดสอบ', 'open', 'active', time, '2026-09-01T00:00:01.000Z');
      [shop.question, shop.answer].forEach((content, messageIndex) => {
        db.prepare('INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING').run(`${shop.id}-message-${messageIndex + 1}`, shop.id, conversationId, messageIndex ? 'assistant' : 'customer', content, null, `2026-09-01T00:00:0${messageIndex}.000Z`);
      });
    }
  });
}
