# API baseline v0.1.0

Base URL: `http://127.0.0.1:3000/api/v1` ใช้ JSON UTF-8 และชื่อ field แบบ `snake_case` ส่วน path parameter ใช้ `shopId`, `knowledgeId`, `conversationId` ตาม OpenAPI

Contract ที่อ่านด้วยเครื่อง: [openapi.json](openapi.json) หรือ `GET /openapi.json` จาก server; API Console: `/docs` โดย runtime route และ request validation ใช้ source เดียวกันใน `src/lib/contracts.js`

Runtime ใช้ PostgreSQL; timestamp ใน response ยังเป็น ISO UTC และ `meta.total` เป็น number ตาม contract เดิม `/api/health` และ `/health` ตรวจ DB จริง หาก connection/schema ไม่พร้อมคืน HTTP 503 `DATABASE_UNAVAILABLE` โดยไม่เปิดเผย SQL หรือ credentials

เมื่อ `APP_MAINTENANCE_MODE=true` business API รวม webhook ตอบ HTTP 503 `MAINTENANCE_MODE` ก่อน DB/auth/body พร้อม `Retry-After: 60`, `Cache-Control: no-store` และ request ID; health ยังคงตรวจ DB ตั้งค่า environment แล้ว restart ทุก process เพื่อเข้า/ออก maintenance และรอ writers เก่าหยุดก่อน snapshot

LINE webhook บันทึก event กับ text job ใน transaction เดียวและตอบสำเร็จหลัง commit `processed_count` คือจำนวน jobs ใหม่ ไม่ใช่จำนวนคำตอบที่ส่งแล้ว ทุก event ต้องมี webhookEventId หรือ message.id; text ต้องมี userId และข้อความที่ไม่ว่าง หาก event ID ชนกับร้านอื่นคืน 409 `LINE_EVENT_COLLISION` โดยไม่เปิดเผยร้านเดิม ประเภทที่ไม่รองรับเก็บ ignored ไม่มี job ดู [นโยบาย delivery/recovery](line-jobs.md)

`POST /api/v1/shops/{shopId}/line/simulate` ใช้ได้ทั้ง development และ production โดยต้องเข้าสู่ระบบเป็นเจ้าของร้าน ใช้ระบบเตรียมคำตอบเดียวกับ LINE จริง แต่บันทึก event/message ทดสอบและไม่ส่งข้อความออกไป LINE ไม่สร้างงานส่งใน `line_jobs` บัญชี demo ต้อง seed เองใน local; seed ยังถูกปิดใน production

## รูปแบบกลาง

```json
{ "data": { "id": "shop-coffee", "name": "บ้านกาแฟ" } }
```

ตัวอย่างข้างบนแสดง envelope เท่านั้น; schema ฉบับเต็มของแต่ละ resource อยู่ใน OpenAPI รายการใช้รูปแบบ:

```json
{ "data": [], "meta": { "limit": 50, "offset": 0, "total": 0 } }
```

ทุก list รับ `limit` จำนวนเต็ม 1–100 (default 50) และ `offset` จำนวนเต็มตั้งแต่ 0 (default 0) เรียง `created_at ASC, id ASC` ไม่รับ query ที่ไม่รู้จักหรือชื่อซ้ำ ใช้ total เพื่อทำหน้าถัดไป การเพิ่ม/ลบข้อมูลระหว่างเปลี่ยนหน้าอาจทำให้ offset เปลี่ยนตำแหน่ง; frontend ควร refresh รายการเมื่อมี mutation

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request body failed validation",
    "details": [{ "field": "body.name", "message": "Required" }]
  },
  "request_id": "c4958641-07e1-4aab-9dfe-12ac0a213b35"
}
```

ทุก response มี `X-Request-Id`; error ใช้ค่าเดียวกันใน body ข้อความ message ใช้ช่วยวิเคราะห์ ส่วน frontend ควรตัดสินจาก HTTP status และ `error.code` การเขียนส่ง `Content-Type: application/json`; body สูงสุด 128 KiB; field ที่ไม่รู้จักถูกปฏิเสธ รวมถึงการส่ง `shop_id`, `created_by` หรือ `author_user_id` เพื่อสวมสิทธิ์

| HTTP | ความหมาย / code สำคัญ |
|---|---|
| 200 | อ่าน/แก้ไขสำเร็จ หรือล็อกอินสำเร็จ |
| 201 | สร้างข้อมูลสำเร็จ |
| 204 | ลบ/ออกจากระบบสำเร็จ ไม่มี body |
| 400 | `INVALID_JSON`, `INVALID_QUERY`, `INVALID_PATH` |
| 401 | `UNAUTHORIZED`, `INVALID_CREDENTIALS` |
| 403 | `FORBIDDEN` สมาชิกมีสิทธิ์ไม่พอ |
| 404 | `NOT_FOUND` ไม่มีข้อมูลหรือไม่มีสิทธิ์ในร้าน ป้องกันเปิดเผยข้อมูลร้านอื่น |
| 405 | `METHOD_NOT_ALLOWED` พร้อม header Allow |
| 409 | `EMAIL_EXISTS`, `CONVERSATION_CLOSED`, `BOT_ACTIVE` |
| 413 / 415 / 422 | `PAYLOAD_TOO_LARGE` / `UNSUPPORTED_MEDIA_TYPE` / `VALIDATION_ERROR` |
| 429 | `RATE_LIMITED` ล็อกอิน/สมัครรวม 20 ครั้ง/นาทีต่อ IP ต่อ process พร้อม Retry-After |
| 500 | `INTERNAL_ERROR` ไม่ส่ง SQL หรือ stack trace ให้ client |

## Authentication และสิทธิ์

`register/login` ส่ง `{data: {user, access_token, token_type: "Bearer", expires_at}}` กลับมา จากนั้นส่ง `Authorization: Bearer <access_token>` ทุก endpoint ที่ต้องล็อกอิน Token เป็น opaque random token อายุ 7 วัน ไม่มี refresh token; logout เพิกถอน token ที่ใช้ในคำขอนั้น รหัสผ่านต้องยาว 10–128 ตัวอักษร ไม่มีช่องว่างแทรกในอีเมล

| สิทธิ์ | อ่านร้าน/ความรู้/แชต | แก้ร้าน/CRUD ความรู้ | สร้างแชต/ข้อความ/เปลี่ยน bot mode |
|---|---|---|---|
| owner | ได้ | ได้ | ได้ |
| agent | ได้ | ไม่ได้ | ได้ |
| ไม่ใช่สมาชิก | 404 | 404 | 404 |

ผู้ใช้ที่ล็อกอินทุกคนสร้างร้านใหม่ได้และเป็น owner อัตโนมัติ การเชิญสมาชิกและเปลี่ยน role ยังไม่มี API; seed เริ่มต้นด้วย owner แยกร้านกัน

ข้อมูลร้านที่ตอบจาก API มี `member_role` (`owner` หรือ `agent`) ของผู้ใช้ปัจจุบัน เพื่อให้ frontend แสดงปุ่มแก้ไขแบบ read-only ได้ถูกต้อง ค่านี้คำนวณจาก session และ membership ฝั่ง server ไม่รับจาก request body

## Endpoint ที่ทำงานแล้ว

ทุก path ในตารางต่อท้าย `/api/v1` ยกเว้น health

| Method | Path | หน้าที่ |
|---|---|---|
| GET | `/health` (นอก prefix) | ตรวจ server และ database ไม่ต้องล็อกอิน |
| POST | `/auth/register` | สร้างผู้ใช้และ session |
| POST | `/auth/login` | เข้าสู่ระบบ |
| POST | `/auth/logout` | ออกจาก session ปัจจุบัน |
| GET | `/users/me` | ข้อมูลผู้ใช้ที่ล็อกอิน ไม่มี password hash |
| GET, POST | `/shops` | รายการร้านที่มีสิทธิ์ / สร้างร้าน |
| GET, PATCH | `/shops/{shopId}` | อ่าน / แก้ข้อมูลร้าน |
| GET, POST | `/shops/{shopId}/knowledge` | รายการรวม draft / สร้างความรู้ |
| GET, PATCH, DELETE | `/shops/{shopId}/knowledge/{knowledgeId}` | อ่าน / แก้ / ลบความรู้ |
| GET, POST | `/shops/{shopId}/conversations` | รายการ / สร้างบทสนทนา |
| GET, PATCH | `/shops/{shopId}/conversations/{conversationId}` | อ่าน / เปลี่ยน status และ bot_mode |
| GET, POST | `/shops/{shopId}/conversations/{conversationId}/messages` | ประวัติข้อความ / บันทึกข้อความ |

PATCH เปลี่ยนเฉพาะ field ที่ส่งมา ต้องมีอย่างน้อย 1 field ไม่รับ `null` สำหรับล้างข้อความ ให้ใช้ `""` เฉพาะ description, opening_hours และ persona

## Request ตัวอย่าง

สร้างร้าน (`name` จำเป็น ที่เหลือไม่บังคับ):

```json
{ "name": "บ้านกาแฟ", "description": "กาแฟและเบเกอรี", "opening_hours": "08:00-18:00", "persona": "สุภาพ เป็นกันเอง" }
```

สร้างความรู้ (ต้องมีทั้ง 4 field):

```json
{ "kind": "faq", "title": "เปิดกี่โมง", "content": "เปิดทุกวัน 08:00-18:00", "status": "published" }
```

สร้างบทสนทนา (ต้องมีทั้ง 3 field; status เริ่ม open และ bot_mode เริ่ม active):

```json
{ "channel": "web", "customer_external_id": "customer-001", "customer_name": "ลูกค้าทดสอบ" }
```

บันทึกข้อความ (ต้องมีทั้ง 2 field):

```json
{ "role": "customer", "content": "มีลาเต้ไหมครับ" }
```

รับ role `customer` เพื่อจำลองข้อความขาเข้าภายในเครื่อง และ `agent` สำหรับคำตอบเจ้าหน้าที่ ไม่รับ `assistant/system` จาก client แม้มี role นี้ในฐานข้อมูล ข้อความที่บันทึกผ่าน endpoint นี้ยังไม่ถูกส่งออกช่องทางภายนอก และการส่งซ้ำจะสร้างข้อความใหม่ทุกครั้ง จึงไม่ควร retry POST อัตโนมัติเมื่อไม่ทราบผลลัพธ์

## ตัวอย่าง workflow ส่งต่อเจ้าหน้าที่

ใช้ `$apiBase` และ `$apiHeaders` จาก README:

```powershell
$conversationUrl = "$apiBase/shops/shop-coffee/conversations/shop-coffee-conversation-1"

# เปลี่ยนจาก active เป็น human เพื่อให้เจ้าหน้าที่ตอบ
Invoke-RestMethod -Method Patch -Uri $conversationUrl -Headers $apiHeaders -ContentType 'application/json' -Body '{"bot_mode":"human"}'

# เก็บคำตอบเจ้าหน้าที่ ผู้เขียนอ้างจาก session อัตโนมัติ
Invoke-RestMethod -Method Post -Uri "$conversationUrl/messages" -Headers $apiHeaders -ContentType 'application/json' -Body '{"role":"agent","content":"Hello, how can I help?"}'

# กลับสู่สถานะพร้อมให้บอททำงาน
Invoke-RestMethod -Method Patch -Uri $conversationUrl -Headers $apiHeaders -ContentType 'application/json' -Body '{"bot_mode":"active"}'
```

| สถานะ | กติกาที่บังคับตอนนี้ |
|---|---|
| open + active | บันทึก customer ได้; agent ต้องเปลี่ยนเป็น paused/human ก่อน |
| open + paused | บันทึก customer/agent ได้; แสดงว่าหยุดบอทชั่วคราว |
| open + human | บันทึก customer/agent ได้; แสดงว่าเจ้าหน้าที่ดูแล |
| closed | ปฏิเสธข้อความใหม่ทุก role ที่เปิดให้ API ด้วย 409; PATCH กลับ open ได้ |

การเปลี่ยน active/paused/human ทำได้โดยสมาชิกของร้านทั้งสอง role Durable LINE worker ตรวจ `status` และ `bot_mode` ใหม่ก่อนส่งข้อความ เมื่อ bot inactive จะเก็บข้อความลูกค้าโดยไม่ตอบอัตโนมัติ คำตอบปัจจุบันใช้ default reply ไม่ได้เรียก AI provider

## การเปลี่ยน contract ของทีม

v0.1.0 เป็น baseline ที่เตรียมให้ทีมใช้ร่วมกัน ไม่ได้หมายถึงมีผู้ร่วมทีมลงนามรับรองแล้ว เมื่อเปลี่ยน field, status หรือ semantics ให้แก้ `src/lib/contracts.js`, implementation, test และเอกสารใน PR เดียวกัน พร้อมสร้าง `docs/openapi.json` ใหม่ จุดที่ทำให้ client เดิมใช้ไม่ได้ต้องหารือทีมก่อน merge และพิจารณา prefix v2
