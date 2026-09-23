-- ข้อมูลตัวอย่างสำหรับพัฒนาในเครื่องเท่านั้น
-- ใช้หลังจากรัน migrations/001_initial.sql บนฐานข้อมูลว่าง
-- รหัสผ่านของผู้ใช้ทั้งสองคน: DemoPass!2026
-- Bearer token ตัวอย่างของเจ้าของร้าน:
-- MDEyMzQ1Njc4OWFiY2RlZmdoaWprbG1ub3BxcnN0dXY

BEGIN IMMEDIATE;

INSERT INTO users (id, email, name, password_hash, created_at) VALUES
  (
    'user-owner-demo',
    'owner@example.test',
    'เจ้าของร้านตัวอย่าง',
    'scrypt:ce564ff63da339c07f7c1deeb0a5594f:07dc55cdcd6044b0b7c7eaadfd29264ff93f821ccbe35db0ce9a5af4063767b5d300ae7eefc210bc2fa26e3c5a00912ad5324639c8dfd8d6ab2559a1fdcb6e91',
    '2026-09-23T09:00:00.000Z'
  ),
  (
    'user-agent-demo',
    'agent@example.test',
    'เจ้าหน้าที่ร้านตัวอย่าง',
    'scrypt:ce564ff63da339c07f7c1deeb0a5594f:07dc55cdcd6044b0b7c7eaadfd29264ff93f821ccbe35db0ce9a5af4063767b5d300ae7eefc210bc2fa26e3c5a00912ad5324639c8dfd8d6ab2559a1fdcb6e91',
    '2026-09-23T09:01:00.000Z'
  );

INSERT INTO shops (
  id,
  name,
  description,
  opening_hours,
  persona,
  created_at,
  updated_at
) VALUES (
  'shop-demo',
  'ร้านกาแฟตัวอย่าง',
  'จำหน่ายกาแฟ เครื่องดื่ม และเบเกอรี',
  'ทุกวัน 08:00-18:00',
  'ตอบสุภาพ กระชับ และเป็นกันเอง',
  '2026-09-23T09:02:00.000Z',
  '2026-09-23T09:02:00.000Z'
);

INSERT INTO shop_memberships (shop_id, user_id, role, created_at) VALUES
  ('shop-demo', 'user-owner-demo', 'owner', '2026-09-23T09:03:00.000Z'),
  ('shop-demo', 'user-agent-demo', 'agent', '2026-09-23T09:04:00.000Z');

INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (
  '06596c158e2895cca29034eb57f161cacbfdcbe8891f817fffb3888dbd57ae5d',
  'user-owner-demo',
  '2027-09-23T09:05:00.000Z',
  '2026-09-23T09:05:00.000Z'
);

INSERT INTO knowledge_entries (
  id,
  shop_id,
  kind,
  title,
  content,
  status,
  created_by,
  created_at,
  updated_at
) VALUES
  (
    'knowledge-hours-demo',
    'shop-demo',
    'faq',
    'เวลาเปิดร้าน',
    'ร้านเปิดทุกวัน เวลา 08:00-18:00',
    'published',
    'user-owner-demo',
    '2026-09-23T09:06:00.000Z',
    '2026-09-23T09:06:00.000Z'
  ),
  (
    'knowledge-coffee-demo',
    'shop-demo',
    'product',
    'เมนูกาแฟแนะนำ',
    'อเมริกาโนเย็น 60 บาท และลาเต้เย็น 75 บาท',
    'published',
    'user-agent-demo',
    '2026-09-23T09:07:00.000Z',
    '2026-09-23T09:07:00.000Z'
  );

INSERT INTO conversations (
  id,
  shop_id,
  channel,
  customer_external_id,
  customer_name,
  status,
  bot_mode,
  created_at,
  updated_at
) VALUES (
  'conversation-demo',
  'shop-demo',
  'web',
  'customer-demo-001',
  'ลูกค้าตัวอย่าง',
  'open',
  'human',
  '2026-09-23T09:08:00.000Z',
  '2026-09-23T09:11:00.000Z'
);

INSERT INTO messages (
  id,
  shop_id,
  conversation_id,
  role,
  content,
  author_user_id,
  created_at
) VALUES
  (
    'message-customer-demo',
    'shop-demo',
    'conversation-demo',
    'customer',
    'วันนี้ร้านเปิดถึงกี่โมงครับ',
    NULL,
    '2026-09-23T09:09:00.000Z'
  ),
  (
    'message-assistant-demo',
    'shop-demo',
    'conversation-demo',
    'assistant',
    'วันนี้ร้านเปิดถึงเวลา 18:00 ครับ',
    NULL,
    '2026-09-23T09:10:00.000Z'
  ),
  (
    'message-agent-demo',
    'shop-demo',
    'conversation-demo',
    'agent',
    'หากต้องการสอบถามเมนูเพิ่มเติม แจ้งได้เลยครับ',
    'user-agent-demo',
    '2026-09-23T09:11:00.000Z'
  );

COMMIT;
