# รีวิวระยะ C — PostgreSQL schema และ migrations

วันที่: 6 ตุลาคม 2026 (Asia/Bangkok)
Branch: `codex/postgresql-render-migration`

## ผลลัพธ์

เพิ่ม PostgreSQL migrations และ runner แล้ว ทดสอบกับ PostgreSQL 18.4 บน local และ apply ใน `chatbot_dev` โดยไม่มี seed/import ข้อมูลธุรกิจ SQLite source และ migrations เดิม 001–003 ไม่ถูกแก้

| ไฟล์ | หน้าที่ |
|---|---|
| `migrations/postgresql/001_initial.sql` | 9 ตารางธุรกิจตาม SQLite schema หลัง migration 003 พร้อม CHECK/FK/default/index |
| `migrations/postgresql/002_line_jobs.sql` | durable job storage, tenant-scoped event/checkpoint FKs, unique event ต่อ job และ indexes สำหรับ claim/expired lease |
| `migrations/postgresql/003_defer_job_checkpoint_references.sql` | เลื่อนการตรวจ checkpoint FKs ไปท้าย transaction เพื่อให้ cascade เมื่อร้านถูกลบเสร็จครบทั้งเส้นทาง events/jobs และ conversations/messages |
| `scripts/postgresql/migrations.js` | อ่าน SQL/checksum, ถือ advisory lock บน dedicated client, validate history แล้ว apply transaction ต่อไฟล์ |
| `scripts/migrate-postgresql.js` | CLI ที่ไม่เปิดเผย connection/SQL secrets และ exit nonzero เมื่อ migration ล้มเหลว |
| `src/lib/postgresql-schema.js` | ตรวจความพร้อม schema แบบ read-only และ helpers สำหรับ ISO UTC/safe numeric counts |
| `src/lib/db.js` | runtime singleton ตรวจ schema ก่อนส่ง DB ให้ผู้เรียก; ตั้ง search_path เฉพาะ schema ที่เลือกและ timezone UTC |
| `integration/postgresql-fixture.js` | จำกัด tests ที่ loopback chatbot_test และแยก schema สุ่มพร้อม cleanup |
| `integration/postgresql-schema.js` | ทดสอบ migrations, constraints, tenants, cascade/restrict และ data types |
| `integration/postgresql.js` | ปรับ singleton test ให้ตรวจ missing schema, migrate แล้ว retry และ hot reload |
| `tests/postgresql-types.test.js` | ตรวจค่า null/ISO UTC, overflow ของ count และ schema name ที่ไม่ปลอดภัย |
| `package.json`, `.env.example`, `README.md` | เพิ่มคำสั่งและวิธีรัน migration/schema tests พร้อม DB_SCHEMA |

## การตัดสินใจสำคัญ

- IDs เป็น TEXT COLLATE C รวม ID แบบ `shop-coffee`; ไม่บังคับ UUID และไม่เพิ่ม UNIQUE ของ open conversation
- Email ใช้ unique index บน `lower(email)`; การเปลี่ยน login query เป็น case-insensitive อยู่ระยะ D
- เวลาเป็น TIMESTAMPTZ พร้อมปฏิเสธ infinity; pg ส่ง Date ที่ JSON serialize เป็น ISO UTC ได้ และมี helper สำหรับ mapping ชัดเจน
- COUNT(*) ยังเป็น string ตาม pg default; แปลงเฉพาะ count ผ่าน `countToNumber` ซึ่งปฏิเสธค่าที่เกิน safe integer ไม่เปลี่ยน parser bigint ทั้งระบบ
- ยังคง composite membership/conversation FK, role/author CHECK, enum/length/trim และ delete behavior เดิมของ 9 ตาราง
- line_jobs เก็บ JSONB object และ checkpoints ภายใน ไม่มี consumer หรือ public API ใหม่ การคัด payload ที่จำเป็น/ไม่เก็บ credentials ต้องทำใน producer ระยะ F
- Job checkpoints อ้าง message ของร้านและ conversation เดียวกัน การลบ checkpoint โดยตรงที่ยังมี job อ้างอยู่จะถูกปฏิเสธตอนจบ transaction; ลบทั้งร้านได้ด้วย cascade รวม job
- Migration 003 เพิ่มเพื่อแก้ปัญหา cascade ที่พบจาก regression test หลัง 002 ถูก apply ใน local แล้ว จึงไม่แก้ checksum ของ 002 ย้อนหลัง

## Runner และ runtime

```powershell
npm run db:migrate:postgres
npm run test:postgres
npm run test:postgres:schema
```

`db:migrate` เดิมยังใช้ SQLite ระหว่างรอ D คำสั่งใหม่โหลด `.env` และใช้ DATABASE_URL/DB_SCHEMA (default public) schema ต้องมีอยู่แล้ว runner ไม่สร้าง DB/schema โดยเดาเป้าหมาย

Runner normalize CRLF → LF ก่อน SHA-256; advisory lock ครอบคลุมการสร้าง ledger, อ่าน/check ประวัติ และ apply ทุกไฟล์บน client เดียว ใช้ transaction แยกต่อไฟล์ หาก SQL หรือการบันทึก ledger ล้มเหลว ทั้งไฟล์จะ rollback แต่ไฟล์ก่อนหน้าที่สำเร็จแล้วไม่ถูกย้อนกลับ ตรวจ missing/changed/out-of-order applied history ก่อน apply ไฟล์ใหม่ ปิด client และคืน lock ใน finally

`getRuntimeDatabase()` เปิด pool แล้วตรวจ required tables/versions โดยไม่เขียน DDL หากไม่พร้อมจะปิด pool และ fail พร้อมคำสั่ง migrate สามารถ retry หลัง migrate ได้ `openDatabase()` ยังคง connection-only สำหรับ tooling ก่อนสร้าง schema Runtime gate ไม่ใช่เครื่องมือตรวจ drift ของทุก column/index; migration checksum ตรวจโดย runner

## ผลทดสอบและรีวิว

| การตรวจ | ผล |
|---|---|
| `npm test` | 27/27 ผ่าน ไม่มี skipped |
| `npm run test:postgres` | 2 กลุ่มผ่าน รวม schema gate/retry, transactions และ connection recovery |
| `npm run test:postgres:schema` | 3 กลุ่มผ่าน ไม่มี skipped |
| `npm run api:check` | ผ่าน |
| `npm run build` | ผ่าน |
| `git diff --check` | ผ่าน |
| SQLite migration diff | ไม่มีการแก้ทั้ง 3 ไฟล์ |
| Local development migration | apply 001–003 แล้ว; รันซ้ำ applied 0 |

Schema tests ครอบคลุม fresh install, concurrent runners, rerun ไม่เปลี่ยน ledger, CRLF checksum, changed checksum, SQL failure, ledger-write failure, atomic rollback, retry/lock release, invalid CHECK/NOT NULL/timestamps, case-insensitive email race, tenant crossover ทุกเส้นทางหลัก, job deduplication, valid agent/checkpoint/lease, delete RESTRICT/CASCADE รวมร้านที่มี job checkpoint, C collation และ timestamp/count serialization

Tests สร้างข้อมูลสมมติใน schema สุ่มของ chatbot_test และลบเฉพาะ schema นั้น ไม่ reset public หรือใช้ SQLite source เป็น fixture Log อยู่ใน `tmp/phase-a/phase-c-*.log` ที่ไม่เข้า Git

ไม่พบข้อบกพร่องค้างจากการทดสอบในขอบเขต C หลังแก้ cascade แล้ว ยังไม่ถือว่า API ใช้ PostgreSQL: API/auth/services เดิมยังใช้ SQLite และจะเชื่อม schema/types helpers นี้ใน D ดังนั้นการทดสอบ API บน PostgreSQL จริงยังเป็น gate ของ D เช่นเดียวกับ consumer/recovery ที่เป็นงาน F ยังไม่ได้ import ข้อมูลหรือ deploy Render

เอกสารอ้างอิง: [PostgreSQL advisory locks](https://www.postgresql.org/docs/18/explicit-locking.html), [node-postgres data types](https://node-postgres.com/features/types)
