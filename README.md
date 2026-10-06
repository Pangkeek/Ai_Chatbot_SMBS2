# SMB Chatbot Platform — Next.js

เว็บแอป Next.js สำหรับจัดการ Chatbot หลายร้าน พร้อม REST API, PostgreSQL, OpenAPI และข้อมูลทดสอบ 2 ร้าน รัน local ได้ด้วย PostgreSQL 18 โดยไม่ต้องใช้ AI API key

## รันครั้งแรก

> สถานะระยะ G: โค้ด/CI, render.yaml และ production rehearsal ในเครื่องพร้อมแล้ว ยังไม่ได้สร้าง/deploy Render หรือทดสอบ live LINE บน staging ข้อมูลยังไม่ได้ import ลงฐานพัฒนา/production ผู้ใช้ดำเนินการส่วน Render ตาม [คู่มือ staging](docs/render-staging.md)

### PostgreSQL สำหรับพัฒนา

ใช้ PostgreSQL 18 แยก `chatbot_dev` และ `chatbot_test` หากมี Docker ให้เปิดด้วย `docker compose up -d postgres` ซึ่งเก็บข้อมูลใน named volume และ bind เฉพาะ `127.0.0.1:55432` ค่ารหัสผ่านใน Compose เป็นตัวอย่างสำหรับ local เท่านั้น SQL init สร้าง test DB เฉพาะครั้งแรกที่ volume ว่าง

เพิ่มค่า PostgreSQL จาก `.env.example` ลง `.env` โดยรักษาค่าเดิมไว้ จากนั้นรัน:

```powershell
npm run db:check:postgres
npm run db:migrate:postgres
npm run test:postgres
npm run test:postgres:schema
npm test
```

Scripts โหลด `.env` ผ่าน `--env-file-if-exists` และ fail เมื่อไม่มี URL ไม่สร้าง SQLite ทดแทน Tests ที่ใช้ PostgreSQL ต้องมี `TEST_DATABASE_URL` ที่ชี้ loopback และชื่อ `chatbot_test` ต่างจาก runtime DB; ถ้าขาดจะ fail ไม่ skip CI pin Node 24.19.0/npm 11.19.0 ใช้ PostgreSQL 18 และแยก `test:sqlite`, `test:runtime`, `test:import`; `npm test` ยังรัน tests หลักรวมทั้งหมด

`DB_POOL_MAX=5`, `DB_CONNECT_TIMEOUT_MS=5000`, `DB_QUERY_TIMEOUT_MS=10000` (server statement timeout) ต้องเป็นจำนวนเต็มบวก TLS ใช้ `disable` ได้เฉพาะ loopback, `require` เข้ารหัสโดยไม่ตรวจ certificate สำหรับ internal endpoint ที่กำหนดไว้ในแผน และ `verify-full` ตรวจ certificate สำหรับ external โดยเป็นค่า default ของ layer ห้ามใส่ query parameters เช่น `sslmode` ใน URL เพื่อป้องกัน override SSL config

`openDatabase()` ตรวจ connection เท่านั้น ไม่ migrate/seed; scripts ต้อง `await db.close()` ใน `finally` ส่วน runtime ใช้ `getRuntimeDatabase()`/`closeRuntimeDatabase()` เพื่อแชร์ initialization promise และ pool ต่อ process รวม hot reload ภายใน `transaction(db, async tx => ...)` ใช้เฉพาะ `tx.query` ไม่เรียก pool เดิมซ้ำ และไม่ถือ transaction ระหว่าง hash password หรือเรียก LINE/AI

`db:migrate` และ `db:migrate:postgres` ใช้ PostgreSQL runner เดียวกัน ล็อกด้วย advisory lock บน connection เดียวตลอดการรัน ตรวจ checksum ก่อน apply และ commit แยกต่อไฟล์ เมื่อไฟล์ใดผิดจะ rollback ไฟล์นั้นพร้อม migration record แต่ไฟล์ก่อนหน้าที่สำเร็จยังอยู่ แก้ด้วย migration ใหม่ ห้ามแก้ไฟล์ที่ apply แล้ว ไม่มี down migration อัตโนมัติ ใช้ npm/package-lock.json เป็นมาตรฐาน

`getRuntimeDatabase()` ตรวจ schema/required migration versions แบบ read-only และ fail เมื่อยังไม่พร้อม ให้รัน migration ก่อนเปิด runtime ไม่สร้างตารางระหว่างรับ request ใช้ schema `public` โดย default; `DB_SCHEMA` ใช้เลือก schema ที่สร้างไว้แล้ว โดย tests สร้าง schema สุ่มแยกต่อ suite และ cleanup เฉพาะของตัวเอง ดู [รีวิวระยะ C](PLAN/phase-c-review.md)

เครื่องนี้ทดสอบด้วย PostgreSQL 18.4 ที่ติดตั้งไว้ (ไม่มี Docker CLI) ใน cluster แยก `data/postgresql-phase-b` ดูผลทดสอบและวิธีเปิดใน [รีวิวระยะ B](PLAN/phase-b-review.md)

### เปิดแอปและเติม demo เฉพาะ local

ต้องมี **Node.js 24.19.0 ขึ้นไปในสาย 24.x** และ **npm 11.19.0** ติดตั้งแพ็กเกจด้วยคำสั่ง:

เปิด terminal ในโฟลเดอร์โครงการแล้วรัน:

```powershell
npm install
# เพิ่มค่าจาก .env.example ลง .env และเปิด PostgreSQL ก่อน
npm run db:migrate
npm run db:seed
npm run dev
```

เปิด **http://127.0.0.1:3000/app** เพื่อใช้แดชบอร์ด, **http://127.0.0.1:3000/docs** เพื่อใช้ API Console และ **http://127.0.0.1:3000/health** เพื่อตรวจการเชื่อมต่อฐานข้อมูล หยุด server ด้วย `Ctrl+C`

สำหรับ production ให้รัน `npm run build` แล้วจึง `npm start` Next.js จะสร้างหน้าเว็บและ Tailwind CSS ในขั้น build หน้าเว็บและ REST API ให้บริการจาก origin เดียวกัน สไตล์ของหน้าเว็บอยู่ใน utility classes ของ JSX โดย `src/styles/globals.css` มีเพียงการนำเข้า Tailwind และตั้งค่าฟอนต์

| ร้านทดสอบ | อีเมล | รหัสผ่าน | shopId |
|---|---|---|---|
| บ้านกาแฟ | coffee@example.test | DemoPass!2026 | shop-coffee |
| บ้านดอกไม้ | flower@example.test | DemoPass!2026 | shop-flower |

แต่ละร้านมีเจ้าของ 1 คน ความรู้ 3 รายการ บทสนทนา 1 รายการ และข้อความ 2 รายการ ลูกค้าทั้งสองร้านใช้ external ID เดียวกันโดยตั้งใจ เพื่อทดสอบว่าระบบไม่รวมข้อมูลข้ามร้าน ข้อความ assistant ใน seed เป็นข้อมูลตัวอย่างที่เขียนไว้ล่วงหน้า

`seed` รันซ้ำได้โดยไม่สร้างแถวซ้ำหรือเขียนทับแถวที่มีอยู่ หากลบข้อมูลตัวอย่างบางแถวแล้วรัน seed แถวนั้นจะถูกเติมกลับ ทั้ง seed function และคำสั่ง seed ปฏิเสธเมื่อ `NODE_ENV=production` Startup ตรวจ schema แบบ read-only ให้รัน migrations แยกก่อนเปิดแอป ไม่มี automatic migration/seed

## ทดลองเส้นทางหลักผ่าน PowerShell

เปิด terminal อีกหน้าขณะ server ทำงาน:

```powershell
$apiBase = 'http://127.0.0.1:3000/api/v1'
$loginBody = @{ email = 'coffee@example.test'; password = 'DemoPass!2026' } | ConvertTo-Json
$loginResult = Invoke-RestMethod -Method Post -Uri "$apiBase/auth/login" -ContentType 'application/json' -Body $loginBody
$apiHeaders = @{ Authorization = "Bearer $($loginResult.data.access_token)" }

Invoke-RestMethod -Uri "$apiBase/shops" -Headers $apiHeaders
Invoke-RestMethod -Uri "$apiBase/shops/shop-coffee/knowledge" -Headers $apiHeaders
Invoke-RestMethod -Uri "$apiBase/shops/shop-coffee/conversations" -Headers $apiHeaders
Invoke-RestMethod -Uri "$apiBase/shops/shop-coffee/conversations/shop-coffee-conversation-1/messages" -Headers $apiHeaders
```

ลองเปลี่ยน `shop-coffee` เป็น `shop-flower` โดยใช้ token เดิม จะได้รับ HTTP 404 เพราะบัญชีนี้ไม่มีสิทธิ์ในร้านนั้น ตัวอย่างสร้างบทสนทนาและส่งต่อเจ้าหน้าที่อยู่ใน [docs/api.md](docs/api.md)

## เอกสารที่ทีมใช้ร่วมกัน

- [ERD และพจนานุกรมข้อมูล](docs/erd.md)
- [Class diagram ของ core domain](docs/class-diagram.md)
- [ข้อมูล SQL ตัวอย่างสำหรับ migration 001](docs/sample-data-001.sql)
- [ฐานข้อมูล SQLite ตัวอย่างสำหรับ migration 001](docs/sample-data-001.sqlite)
- [สัญญา API และตัวอย่าง workflow](docs/api.md)
- [OpenAPI 3.1 สำหรับนำเข้า Postman / Swagger Editor](docs/openapi.json)
- [สถาปัตยกรรม ขอบเขต และจุดเชื่อมต่อระยะถัดไป](docs/architecture.md)
- [วิธีทำงานร่วมกันและเกณฑ์รับงาน](CONTRIBUTING.md)

`src/lib/contracts.js` เป็นแหล่งกำหนด contract v0.1.0 ทั้ง routing, การตรวจ request และ OpenAPI ที่ server ให้บริการ ส่วน `docs/openapi.json` คือสำเนาที่สร้างจากแหล่งเดียวกัน ทีมสามารถใช้เป็น baseline ในการพัฒนาและทบทวนร่วมกันก่อนเปลี่ยน contract

## โครงสร้าง repository

```text
.github/workflows/ci.yml  ตรวจ test และความตรงกันของ OpenAPI
migrations/              SQL migrations ตามลำดับ พร้อม checksum
src/
  components/            หน้าแดชบอร์ดและ API Console
  hooks/                 ผูกการทำงานของหน้าเว็บฝั่ง browser
  layouts/               layout ร่วมของหน้าเว็บ
  lib/                   routing, auth, database, contract และข้อมูลตัวอย่าง
  pages/                 Pages Router: /, /app, /docs และ API routes
    api/v1/              REST API เดิมบน Next.js API Routes
  services/              business rules, LINE worker และตัวควบคุม UI
  styles/                Tailwind entry และการตั้งค่าฟอนต์
  utils/                 schema validation
scripts/                 migrate, seed, สร้าง OpenAPI
next.config.js          rewrite /health และ /openapi.json
jsconfig.json            alias @/ สำหรับโค้ดใน src
postcss.config.js       ตั้งค่า Tailwind CSS สำหรับ Next.js
public/assets/           รูปภาพที่หน้าเว็บใช้งาน
tests/                   HTTP integration และ database tests
docs/                    ERD, API, architecture, OpenAPI
data/                    ฐานข้อมูล local (ไม่เก็บใน Git)
```

## Configuration

เพิ่มค่าจาก `.env.example` ลง `.env` แล้วปรับให้ตรง PostgreSQL local:

| ตัวแปร | ค่าเริ่มต้น | ความหมาย |
|---|---|---|
| PORT | 3000 | พอร์ต HTTP |
| DATABASE_URL | ต้องตั้ง | PostgreSQL สำหรับแอป |
| TEST_DATABASE_URL | ต้องตั้งเพื่อรัน tests | PostgreSQL chatbot_test แยกจากแอป |
| DB_SCHEMA | public | Schema ที่สร้างไว้แล้ว |
| DATABASE_PATH | ./data/chatbot.sqlite | เฉพาะ SQLite backup tooling |

`.env`, ฐานข้อมูล, log และไฟล์ชั่วคราวถูกตัดออกจาก Git หากพอร์ตถูกใช้ให้เปลี่ยน `PORT` และเปิด URL ตามพอร์ตใหม่ Runtime ไม่ใช้ DATABASE_PATH หากต้องการ dev DB ใหม่ให้สร้าง PostgreSQL DB แยก แล้วตั้ง DATABASE_URL และรัน migrate ก่อน seed

## ตรวจงาน

```powershell
npm test
npm run test:postgres
npm run test:postgres:schema
npm run build
node scripts/openapi.js --check
```

API/worker tests ใช้ PostgreSQL chatbot_test โดยแยก schema สุ่มและ cleanup เฉพาะของแต่ละ suite ตรวจทุก endpoint, tenant isolation, owner/agent, session expiry/logout, validation, handover, foreign keys, seed ซ้ำ, concurrency และ rollback SQLite tests ที่เหลืออ่าน fixture/backup ในพื้นที่ชั่วคราว

เมื่อแก้ contract ให้รัน `node scripts/openapi.js` และ commit ไฟล์ที่สร้างใหม่ไปด้วย CI ถูกเตรียมไว้สำหรับ push/PR หลังนำ repository ขึ้น GitHub

## สิ่งที่พร้อมและงานระยะถัดไป

พร้อมใช้: สมัครสมาชิก/เข้าสู่ระบบ, จัดการร้าน, CRUD ความรู้, ประวัติบทสนทนา/ข้อความ, เปลี่ยนสถานะ bot และ console ทดลอง API ข้อมูลถูกเก็บใน PostgreSQL

## ตรวจสอบ LINE จริง

ในแท็บ **การเชื่อมต่อ LINE** ให้บันทึก Channel Secret และ Channel Access Token ของ Messaging API ก่อน จากนั้นคัดลอก Webhook URL ไปตั้งที่ LINE Developers Console และเปิด **Use webhook** กด **ตรวจสอบกับ LINE** เพื่อเช็ก Token ด้วย `GET /v2/bot/info` เปรียบเทียบ Webhook URL และให้ LINE ส่ง webhook ทดสอบด้วย `POST /v2/bot/channel/webhook/test` สถานะ “เชื่อมต่อและตรวจสอบแล้ว” จะแสดงเมื่อทุกขั้นผ่านเท่านั้น

Webhook URL ต้องเป็น HTTPS ที่ LINE เข้าถึงได้จากอินเทอร์เน็ต การรันที่ `127.0.0.1` ทดสอบการส่ง webhook จริงไม่ได้ ส่วน **LINE Simulator** เป็นการจำลองภายในและคืน 404 ใน production ค่าลับเก็บใน PostgreSQL และไม่ส่งกลับมาที่หน้าเว็บเป็นข้อความเต็ม

ระบบรับ webhook ตรวจลายเซ็นจาก raw body และบันทึก event/job ใน PostgreSQL transaction เดียวก่อนตอบสำเร็จ Worker เริ่มจาก instrumentation ตอน server startup และกู้ pending/expired leases โดยไม่ต้องรอ request แรก ต้องตั้ง `LINE_WORKER_ENABLED=true` ใน server process ที่ต้องการให้ตอบ LINE หากตั้ง false จะยังรับและเก็บ jobs แต่ไม่ประมวลผล ข้อความที่ค้างเกิน reply cutoff จะเก็บข้อความลูกค้าและจบเป็น failed

งานต่อยอด: RAG/embedding, Gemini/OpenAI gateway และ failover การเปลี่ยน `bot_mode` ตอนนี้เป็นการบันทึกสถานะและตรวจเงื่อนไขเจ้าหน้าที่ตอบ ยังไม่มี AI worker ที่ทำงานเบื้องหลัง Endpoint บันทึกข้อความไม่ใช่หลักฐานว่าส่งถึง LINE แล้ว

ดู [รีวิวระยะ G](PLAN/phase-g-review.md), [คู่มือ Render staging](docs/render-staging.md) และ [วิธีดูแลคิว LINE](docs/line-jobs.md) ต้องผ่าน staging จริงก่อน cutover H ส่วนการตั้งค่าและ deploy Render ผู้ใช้ดำเนินการเอง

## นำเข้า SQLite snapshot (ระยะ E)

ใช้ snapshot จาก `npm run db:backup:sqlite` พร้อม `manifest.json` ใน directory เดียวกัน ห้ามชี้ live source หรือคัดลอก main SQLite file ที่ยังมี WAL ตั้ง `SQLITE_SOURCE_PATH` เป็น snapshot ที่จะใช้ตลอด import/verify และตั้ง `DATABASE_URL`/`DB_SCHEMA` เป็น PostgreSQL เป้าหมายที่เตรียม migrations แล้ว

```powershell
$env:SQLITE_SOURCE_PATH = './data/backups/sqlite-<id>/snapshot.sqlite'
npm run db:import:sqlite -- --dry-run
# เมื่อรายงานผ่านและตรวจ target แล้ว จึงนำเข้าจริง
npm run db:import:sqlite
npm run db:verify:import
```

dry-run และ verify ใช้ transaction แบบ read-only ไม่รัน migrations/seed target สำหรับ import ต้องว่างครบทั้ง 9 ตารางธุรกิจและ line_jobs ไม่มี force/reset/upsert โดย import ใช้ transaction เดียวและล็อกตารางเพื่อกัน writers พร้อมกัน หาก query กลางทางผิดหรือ verification ไม่ตรงจะ rollback ทั้งชุด ไฟล์รายงานอยู่ `data/import-reports/` ซึ่งไม่เข้า Git

Batch เริ่มต้น 200 แถว (`SQLITE_IMPORT_BATCH_SIZE`, สูงสุด 1000) และ statement timeout สำหรับ import แยกจาก runtime เป็น 60 วินาที (`DB_IMPORT_QUERY_TIMEOUT_MS`) ไม่ใช่เวลาจำกัดรวม transaction หากข้อมูลใหญ่เกิน maintenance window ให้ปรับแผนก่อน cutover

เครื่องมือตรวจ snapshot checksum, baseline SQLite migrations, timestamps/NUL, lower(email) ตาม PostgreSQL, FK/owner memberships และ counts/checksums ทั้ง 9 ตารางเรียง PK รายงานไม่เก็บ email, message text, password/token hashes หรือ LINE credential values คีย์ของแถวที่ผิดใช้ SHA-256 fingerprint เพื่อให้เทียบได้โดยไม่เผย token_hash ของ sessions

Imported LINE events คง raw history และรายงาน received/processing เป็น unresolved ไม่สร้าง jobs หรือส่ง LINE reply เก่า Snapshot ยังคงมีข้อมูลลับทั้งหมด ต้องเก็บในพื้นที่จำกัดสิทธิ์ การนำเข้าจริง/ตั้งค่าฐาน Render ให้ผู้ใช้ดำเนินการตามขั้นตอนที่เตรียมไว้

หาก connection ขาดระหว่าง COMMIT รายงานจะระบุ `commit-uncertain` ให้รัน verify กับ target เดิมก่อนตัดสินใจ ห้ามล้างฐานหรือ import ทับ ถ้า commit สำเร็จแต่เขียนรายงานสุดท้ายไม่สำเร็จ อาจเหลือ receipt `verified-before-commit`; ใช้ verify เพื่อยืนยันผล

## Repository

โปรเจกต์มี Git repository และ origin แล้ว การเปลี่ยนแปลงระยะ G ในรอบนี้ยังไม่ได้ commit/push ให้เลือก commit ที่ผ่าน CI เมื่อนำขึ้น staging ดูขั้นตอน release ใน `CONTRIBUTING.md` และ `docs/render-staging.md`
