# รีวิวระยะ D — PostgreSQL async runtime/API

วันที่: 6 ตุลาคม 2026 (Asia/Bangkok)  
Branch: `codex/postgresql-render-migration`

## ผลลัพธ์

API, authentication, business services, seed และ LINE worker ใช้ PostgreSQL แบบ async แล้ว Runtime ใน `src/` ไม่มี `DatabaseSync`, `node:sqlite`, `prepare/get/all/run` หรือ SQLite fallback เหลือ URL และ JSON envelope เดิมยังใช้ได้ timestamp เป็น ISO UTC และ pagination total เป็น number

ฐาน `chatbot_dev` มี migrations 001–003 แต่ข้อมูลธุรกิจยังว่าง: users, shops, messages, line_events และ line_jobs เป็น 0 หลัง smoke test ไม่ได้ seed หรือ import ลงฐานพัฒนา ข้อมูล SQLite เดิมและ backup ระยะ A ยังอยู่ การนำเข้าผู้ใช้/ร้าน/ข้อความเดิมอยู่ระยะ E

## การเปลี่ยนแปลงหลัก

| ไฟล์ | หน้าที่หลังแก้ |
|---|---|
| `src/lib/auth.js` | สร้าง session แบบ async ด้วย parameterized SQL; คง scrypt และ token hash เดิม |
| `src/lib/app.js` | await session/membership checks, serialize วันที่ส่วนกลาง, ปิด production simulator และปิดบัง DB error detail |
| `src/lib/apiRuntime.js` | ใช้ PostgreSQL singleton/initialization promise, คืน safe 503 เมื่อ DB/schema ไม่พร้อม และมี explicit close/drain |
| `src/services/service.js` | CRUD/auth/LINE เป็น async, allowlist dynamic identifiers, numeric counts, atomic transactions และ concurrency controls |
| `src/services/worker.js` | async customer/reply transactions, shop/customer lock, await reply generation และอ่าน bot state ซ้ำก่อนส่ง |
| `src/lib/seed.js` | PostgreSQL seed แบบ async/idempotent และปฏิเสธ production ก่อนทำงาน |
| `src/lib/postgresql-schema.js` | serialize Date เป็น ISO UTC ที่ HTTP boundary โดยไม่เปลี่ยน bigint parser |
| `scripts/migrate.js`, `scripts/seed.js` | คำสั่งหลักใช้ PostgreSQL; seed ปิด pool ใน finally และรายงาน failure แบบไม่เผย SQL/credentials |
| `scripts/sqlite/database.js`, `tests/fixtures/sqlite-seed.js` | เก็บ SQLite baseline ไว้สำหรับ backup/migration fixtures แยกออกจาก runtime |
| `tests/api.test.js`, `tests/line.test.js` | ย้าย integration tests เดิมให้รันกับ PostgreSQL schema สุ่มจริง |
| `tests/postgresql-api-regression.test.js` | เพิ่ม concurrency, rollback, production restriction, redaction และ health/runtime retry tests |
| `integration/postgresql-fixture.js` | fixture lifecycle แยก schema และ cleanup สำหรับหลาย suite |
| `src/lib/contracts.js`, `docs/openapi.json`, `docs/api.md` | ระบุ 503 DB unavailable และ simulator 404 ใน production; regenerate OpenAPI |
| `package.json`, `.github/workflows/ci.yml` | tests โหลด .env; CI ใช้ npm และ PostgreSQL 18; ลบ pnpm lockfile ที่เลิกดูแล |
| `.env.example`, `README.md`, `CONTRIBUTING.md` | วิธีเปิด runtime/test PostgreSQL และข้อจำกัดระหว่างย้าย |

## พฤติกรรมและความปลอดภัยของข้อมูล

- INSERT ระบุ columns ทุกจุด; ค่าภายนอกใช้ `$1`, `$2` ฯลฯ ส่วนชื่อ table/column มาจาก allowlist ภายใน
- สมัครผู้ใช้+session, ร้าน+owner membership และข้อความ+conversation updated_at เป็น transaction เดียว ใช้ tx client ตลอด
- scrypt และ LINE HTTP/generation ทำงานนอก transaction จึงไม่ถือ connection รอ external work
- Email lookup ใช้ lower(email); unique index เป็นตัวตัดสินเมื่อสมัครพร้อมกัน เฉพาะ `users_email_lower_idx` violation ถูกแปลงเป็น 409 EMAIL_EXISTS ข้อผิดพลาด unique ของส่วนอื่นไม่ถูกตีความเป็น email ซ้ำ
- Session expiry/logout, 404 ข้ามร้าน, 403 owner-only, bot active/human/closed guards ยังผ่าน contract tests
- LINE configuration ล็อกแถว parent shop แม้ยังไม่มี channel ทำให้ partial updates ที่เข้าพร้อมกันรักษา credential ที่ละไว้ได้
- LINE event insert ใช้ ON CONFLICT DO NOTHING เพื่อรองรับทั้ง global event PK และ composite unique ในกรณี concurrent redelivery ไม่ enqueue ซ้ำ
- ตรวจ signature จาก raw body เดิม; queued work ถูก enqueue หลัง event insert สำเร็จ แต่คิวยังอยู่ใน memory และยังไม่สร้าง durable job
- health await SELECT 1 และคืน 503 DATABASE_UNAVAILABLE เมื่อ query/initialization/schema ล้มเหลว ไม่มี SQL/password/detail ใน response หรือ app/worker error logs
- production simulator คืน 404 ก่อนตรวจ auth/body ที่ handler และก่อน query ที่ service; seed function/CLI ปฏิเสธ production
- Startup/build ไม่ migrate หรือ seed อัตโนมัติ; runtime initialization ตรวจ schema แบบ read-only

## ผลทดสอบ

| การตรวจ | ผล |
|---|---|
| `npm test` | 35/35 ผ่าน ไม่มี skipped รวม API เดิมทั้งหมดบน PostgreSQL |
| `npm run test:postgres` | 2 กลุ่มผ่าน |
| `npm run test:postgres:schema` | 3 กลุ่มผ่าน |
| `npm run api:check` | ผ่านหลัง regenerate |
| `npm run build` | ผ่าน |
| `npm run db:migrate` | PostgreSQL applied 0, unchanged 3 |
| `git diff --check` | ผ่าน |
| SQLite migration diff | ไม่มีการแก้ทั้ง 3 ไฟล์ |

Regression tests เพิ่มการสมัคร email สองคำขอพร้อมกัน, mixed-case login, seed รักษา password hash, failure กลาง register/session/shop/member/message/update, concurrent LINE partial updates/redelivery, async reply ที่เปลี่ยน bot state ก่อนส่ง, production simulator/seed ไม่มี writes, DB errors ไม่เผยข้อมูลและไม่ map unique ผิดประเภท, health 503 หลัง query fail และ initialization retry หลังแก้ configuration

Next.js production smoke test ที่ port 3101: `/api/health`, `/health`, `/api/openapi`, `/app`, `/docs` ได้ 200; `/api/v1/users/me` ไม่มี token ได้ 401; production simulator ที่ไม่มี auth และมี malformed body ได้ 404 ทดสอบโดยไม่สร้างข้อมูลใน chatbot_dev และหยุด test server หลังจบ

Logs อยู่ใน `tmp/phase-a/phase-d-*.log` ที่ไม่เข้า Git Tests ใช้ chatbot_test และ schema สุ่ม ไม่แตะ source SQLite หรือ reset ฐานพัฒนา

## ผลรีวิวและงานถัดไป

ไม่พบข้อบกพร่องค้างในขอบเขต D จากการตรวจและ tests ที่รัน พบและแก้ concurrent webhook conflict ที่เกิดจาก composite unique เพิ่มเติมแล้ว

CI PostgreSQL/npm ถูกดึงบางส่วนจาก G มาทำใน D เพราะ npm test ต้องใช้ PostgreSQL และ pg dependency มีใน npm lockfile เท่านั้น ยังไม่ได้รัน GitHub Actions บน remote; local npm เป็น 11.17.0 ส่วน packageManager ระบุ 11.19.0 การ pin npm ใน CI ให้ตรงทั้งหมดและ Render staging เป็นงานที่ต้องตรวจใน G

ข้อจำกัดสำคัญ: LINE queue ยังเป็น in-process queue ระยะ D ย้าย DB/async behavior แต่ยังไม่รับรองงานรอด restart/crash หรือ delivery certainty หลังส่ง LINE ต้องทำ producer/job checkpoints/leases/recovery ใน F ก่อน production LINE ส่วน imported users/sessions/password hashes จริงต้องพิสูจน์กับ backup/import ใน E และยังไม่ deploy Render

เอกสาร architecture/ERD เดิมที่ยังกล่าวถึง SQLite ต้องปรับครบในรอบเอกสาร G/I รายงานนี้บันทึกสถานะปัจจุบันที่ผ่านการทดสอบแล้ว
