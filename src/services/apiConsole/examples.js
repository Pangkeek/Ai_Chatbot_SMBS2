// ตัวอย่างข้อมูลที่เติมลงใน API Console เมื่อเลือก endpoint
export const requestExamples = {
  register: { email: 'new@example.test', name: 'New owner', password: 'YourPassword123!' },
  login: { email: 'coffee@example.test', password: 'DemoPass!2026' },
  createShop: { name: 'ร้านใหม่', description: 'ข้อมูลร้าน', opening_hours: '09:00-18:00', persona: 'สุภาพ เป็นกันเอง' },
  updateShop: { opening_hours: '08:00-17:00' },
  createKnowledge: { kind: 'faq', title: 'เปิดกี่โมง', content: 'เปิดทุกวัน 08:00-17:00', status: 'published' },
  updateKnowledge: { status: 'draft' },
  createConversation: { channel: 'web', customer_external_id: 'test-customer-1', customer_name: 'ลูกค้าทดสอบ' },
  updateConversation: { bot_mode: 'human' },
  createMessage: { role: 'customer', content: 'ร้านเปิดกี่โมงครับ' },
};
