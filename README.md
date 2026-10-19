# SMB Chatbot Platform — Next.js

เว็บแอป Next.js สำหรับจัดการ Chatbot หลายร้าน พร้อม REST API, PostgreSQL, OpenAPI และข้อมูลทดสอบ 2 ร้าน รัน local ได้ด้วย PostgreSQL 18 โดยไม่ต้องใช้ AI API key

## รันครั้งแรก

> วิธีใช้งานปัจจุบันคือรันบนเครื่องด้วย PostgreSQL ที่เก็บข้อมูลใน Docker volume แยก ดูคำสั่งสั้น ๆ ใน [คู่มือรัน local](docs/local-run.md) ไม่มีการ deploy ไป Render และไม่มีไฟล์ SQLite เดิมให้นำเข้า

### PostgreSQL สำหรับพัฒนา

ใช้ PostgreSQL 18 แยก `chatbot_local` และ `chatbot_test` เปิดด้วย `docker compose -f compose.local.yaml -p smb-chatbot-local up -d` ซึ่งเก็บข้อมูลใน named volume และเปิดฐานข้อมูลที่ `127.0.0.1:55434` ค่ารหัสผ่านใน Compose เป็นตัวอย่างสำหรับ local เท่านั้น SQL init สร้าง test DB เฉพาะครั้งแรกที่ volume ว่าง

สคริปต์ใน [คู่มือรัน local](docs/local-run.md) จัดการขั้นตอนเริ่มต้นให้ หากต้องการรันคำสั่งตรวจแยก ให้คัดลอก `.env.local.example` เป็น `.env` เฉพาะเมื่อยังไม่มีไฟล์ แล้วรัน:

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

`db:migrate` และ `db:migrate:postgres` ใช้ PostgreSQL runner เดียวกัน ล็อกด้วย advisory lock บน connection เดียวตลอดการรัน ตรวจ checksum ก่อน apply และ commit แยกต่อไฟล์ เมื่อไฟล์ใดผิดจะ rollback ไฟล์นั้นพร้อม migration record แต่ไฟล์ก่อนหน้าที่สำเร็จยังอยู่ แก้ด้วย migration ใหม่ ห้ามแก้ไฟล์ที่ apply แล้ว ไม่มี down migration อัตโนมัติ หลัง migrations สำเร็จ CLI จะ rebuild ดัชนีความรู้ก่อนเปิด release; หาก indexing ล้มเหลวให้รันคำสั่งเดิมซ้ำและห้ามเริ่ม release ใช้ npm/package-lock.json เป็นมาตรฐาน

`getRuntimeDatabase()` ตรวจ schema/required migration versions แบบ read-only และ fail เมื่อยังไม่พร้อม ให้รัน migration ก่อนเปิด runtime ไม่สร้างตารางระหว่างรับ request ใช้ schema `public` โดย default; `DB_SCHEMA` ใช้เลือก schema ที่สร้างไว้แล้ว โดย tests สร้าง schema สุ่มแยกต่อ suite และ cleanup เฉพาะของตัวเอง ดู [รีวิวระยะ C](PLAN/phase-c-review.md)

บันทึกการทดสอบ PostgreSQL 18.4 ระยะแรกอยู่ใน [รีวิวระยะ B](PLAN/phase-b-review.md) ส่วนการสาธิต local ปัจจุบันใช้ PostgreSQL 18 ใน Docker

### เปิดแอปและเติม demo เฉพาะ local

ต้องมี **Node.js 24.19.0 ขึ้นไปในสาย 24.x** และ **npm 11.19.0** บนเครื่องนี้สคริปต์เลือก toolchain ที่ตรงเวอร์ชันให้

เปิด terminal ในโฟลเดอร์โครงการแล้วรัน:

```powershell
& ./scripts/local-start.ps1 -SeedDemo
```

เปิด **http://127.0.0.1:3131/** เพื่อเข้าสู่หน้าแนะนำ `/home` ก่อนล็อกอิน จากนั้นกด **เข้าสู่ระบบ** หรือ **จัดการร้านค้า** เพื่อไป `/app` กด **สมัครสมาชิก** เพื่อเปิดแบบฟอร์มสร้างบัญชีโดยตรง ส่วน **http://127.0.0.1:3131/docs** ใช้ API Console และ **http://127.0.0.1:3131/health** ใช้ตรวจการเชื่อมต่อฐานข้อมูล หยุด server ด้วย `Ctrl+C`

## รันด้วย Docker Compose

สำหรับการใช้งานบนเครื่องครั้งนี้ ให้ใช้ [คู่มือรัน local](docs/local-run.md) ซึ่งเปิดเฉพาะ PostgreSQL ใน Compose และรัน Next.js ที่ `127.0.0.1:3131` ด้วย Node บน Windows ขั้นตอนต่อไปนี้เป็นทางเลือกสำหรับการรันแอปทั้งชุดใน Docker:

ติดตั้งและเปิด Docker Desktop ก่อน แล้วรันคำสั่งเดียวจากโฟลเดอร์โปรเจค:

```powershell
docker compose up --build -d
```

เปิด `http://localhost:3000` เพื่อใช้งาน ระบบ build แอปและรัน migration ให้อัตโนมัติเมื่อเริ่ม container ข้อมูล PostgreSQL อยู่ใน Docker volume `postgres_data` จึงยังอยู่เมื่อสั่ง `docker compose down` หากพอร์ต 3000 ถูกใช้งาน ให้กำหนด `PORT` ในไฟล์ `.env` แล้วเปิด URL ตามพอร์ตนั้น

```powershell
docker compose ps       # ดูสถานะ
docker compose logs -f  # ดู log
docker compose down     # หยุดระบบโดยไม่ลบฐานข้อมูล
```

Compose ให้ app แชร์ network namespace กับ PostgreSQL เพื่อใช้ loopback ภายใน container และคงนโยบาย TLS ของ runtime ข้อมูลอยู่ใน volume `postgres_data` ห้ามใช้ `down --volumes` หากต้องเก็บข้อมูล

Compose ใช้ `NODE_ENV=production` จึงไม่เติมบัญชี demo อัตโนมัติ ให้สมัครบัญชีใหม่ผ่านหน้าเว็บได้ทันที ถ้าต้องการข้อมูล demo สำหรับทดลองในเครื่อง ให้รัน `docker compose run --rm -e NODE_ENV=development app npm run db:seed` หลังจากระบบเริ่มแล้ว อย่าใช้บัญชี demo นี้กับระบบที่เปิดให้คนอื่นเข้าถึง

เส้นทางหน้าเว็บของแดชบอร์ด:

| URL | หน้า |
|---|---|
| `/` | ส่งต่อไปหน้าแนะนำ `/home` |
| `/home` | หน้าแนะนำระบบสำหรับผู้เยี่ยมชม |
| `/app` | ร้านค้าทั้งหมดของบัญชี |
| `/app/shops/:shopId/settings` | ข้อมูลธุรกิจของร้าน |
| `/app/shops/:shopId/knowledge` | FAQ และคลังความรู้ |
| `/app/shops/:shopId/line` | การเชื่อมต่อ LINE และ simulator |
| `/docs` | API Console |

ในหน้า FAQ และคลังความรู้มีช่อง **ดูข้อมูลที่ Chatbot ใช้ตอบ** สำหรับลองคำถาม แล้วตรวจข้อมูลร้าน หลักฐานที่ระบบเลือก และโครงสร้าง prompt ที่จะส่งให้บริการ AI ได้ ระบบนำชื่อร้าน ประเภทธุรกิจ สินค้าหรือบริการ รูปแบบบริการ เวลาเปิด และรายละเอียดเพิ่มเติมมาเป็นหลักฐานโดยตรง ส่วน FAQ และความรู้อื่นจะใช้เฉพาะรายการที่เผยแพร่แล้ว FAQ ที่ตรงคำถามมีลำดับก่อนข้อมูลอื่น

ก่อนส่งคำตอบ ระบบตรวจว่าข้อความที่บริการ AI เลือกเป็นข้อความตรงจากหลักฐานของร้านนั้น หากไม่มีหลักฐานจะแจ้งว่าไม่มีข้อมูลยืนยัน คำตอบและรหัสแหล่งข้อมูลถูกเก็บไว้กับบทสนทนา โหมดเริ่มต้นยังตอบแบบคัดข้อความจากหลักฐานในเครื่องได้ และรองรับ endpoint เดิมผ่าน `RAG_GENERATOR_URL` / `RAG_GENERATOR_TOKEN`

งาน task8 เพิ่ม `AI_MODE=dual` เพื่อใช้ Gemini เป็นหลักและ OpenAI สำรอง พร้อม timeout, retry/backoff และ circuit breaker เมื่อทั้งคู่ล้มจะเปลี่ยนห้องเป็น `human` และแจ้งลูกค้าหนึ่งครั้ง บอทจะหยุดจนแอดมินเปิดกลับ ตั้งค่า key และชื่อโมเดลของทั้งสองรายบนเซิร์ฟเวอร์ แล้วรัน migration ก่อนเริ่ม release ดูวิธีเปิดใช้ ทดสอบ และย้อนกลับใน [คู่มือ AI integration](docs/ai-integration.md)

เมื่อไม่กำหนด `AI_MODE` ระบบยังใช้ BuddyShare หรือคีย์ AI เดิมได้ตามการตั้งค่าจาก master รวมถึงการสาธิตด้วยคีย์หลักเพียงรายเดียวและคัดข้อความจากหลักฐานเมื่อบริการล้ม ส่วน `AI_MODE=dual` ต้องมีบริการหลักและ OpenAI ครบ และเลือก Gemini ผ่าน BuddyShare แทน Google โดยตรงได้

ลิงก์จากหน้าแนะนำพาไป `/app` เพื่อใช้ขั้นตอนเข้าสู่ระบบเดิมของแดชบอร์ด หากยังไม่มีบัญชีให้ไป `/app?mode=register` เพื่อเปิดแท็บสมัครสมาชิก หน้าข้อมูลร้านและการเชื่อมต่อ LINE ต้องเลือกจากร้านที่บัญชีมีสิทธิ์เข้าถึง

หน้า `/home` อธิบายฟีเจอร์และเส้นทางที่ใช้งานได้ในปัจจุบัน รวม **บทสนทนาและสถิติ / แอดมินรับช่วงตอบ / Pause/Resume** ที่เปิดได้หลังเลือกร้านในแดชบอร์ด ตาม [หน้าโครงการใน Notion](https://app.notion.com/p/AI-Chatbot-SMBs-3d8d1e39ec9c81158d17e529e229f350)
ภาพอินโฟกราฟิก, FAQ, LINE และ Webhook ที่ใช้ในหน้าแรกอยู่ใน `public/assets/home/` ส่วนสีและลายพื้นหลังของหน้าแรกกำหนดไว้ใน `src/styles/globals.css` ภายใต้ `.home-page` เพื่อไม่กระทบหน้าแดชบอร์ด

เปิด URL ของร้านโดยตรงหรือรีเฟรชหน้าได้ ระบบจะให้เข้าสู่ระบบก่อนหากยังไม่มี session และตรวจสิทธิ์ร้านผ่าน API ก่อนแสดงข้อมูล

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
  pages/                 Pages Router: /, /home, /app, /app/shops/:shopId/*, /docs และ API routes
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

## เริ่มอ่านโค้ดจากตรงไหน

| ต้องการแก้อะไร | เปิดไฟล์/โฟลเดอร์ |
|---|---|
| หน้าแนะนำระบบ | `src/pages/home.jsx` ประกอบ `src/components/home/` |
| หน้าแดชบอร์ด | `src/pages/app/[[...path]].jsx` ประกอบ `src/components/dashboard/` |
| หน้า API Console | `src/pages/docs.jsx` ประกอบ `src/components/api-console/` |
| การแสดงผลและคลิกในแดชบอร์ด | `src/services/dashboardController.js` และตัวช่วยใน `src/services/dashboard/` |
| การตั้งค่า LINE และตัวจำลองแชต | `src/services/dashboard/lineSettings.js` และ `lineSimulator.js` |
| การจัดการ FAQ และคลังความรู้ | `src/services/knowledgeManager.js` ประกอบตัวช่วยใน `src/services/knowledge/` |
| API ฝั่ง server | `src/lib/app.js` จับคู่ route จาก `src/lib/contracts.js` กับคำสั่งใน `src/services/api/` |

แต่ละไฟล์ใน `src/components/` ดูแลหน้าตาและ markup ส่วน `src/services/dashboard/` ดูแลการเรียก API และเหตุการณ์จากปุ่ม/ฟอร์ม รหัส `id` ใน component ยังถูก controller ใช้เชื่อมกับ DOM จึงควรแก้ทั้งสองจุดพร้อมกันเมื่อเปลี่ยนชื่อ `id`

เส้นทาง `/app/shops/:shopId/*` ใช้ไฟล์หน้า `src/pages/app/[[...path]].jsx` ร่วมกัน เพื่อให้การเปลี่ยนแท็บยังใช้แดชบอร์ดชุดเดิม ส่วนเนื้อหาของแต่ละแท็บแยกใน `src/components/dashboard/` แล้ว

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

## ค้นความรู้และตอบ LINE (งานข้อ 7)

ความรู้สถานะ `published` จะถูกแบ่งและทำ local embedding ลง `knowledge_chunks` เมื่อสร้างหรือแก้ผ่าน API/หน้า **FAQ/ข้อมูลความรู้** การเปลี่ยนเป็น `draft` และการลบจะเอาออกจาก index ทันที ตัวค้นกรอง `shop_id` และสถานะ `published` ใน SQL ก่อนจัดอันดับ คำถาม FAQ ที่ตรงชัดเจนใช้คำตอบเดิม ส่วนคำถามอื่นใช้ข้อความจากส่วนที่เกี่ยวข้อง ถ้าไม่พบหลักฐานจะตอบขอให้ติดต่อเจ้าหน้าที่

หลังอัปเกรดฐานข้อมูลเดิม ให้สร้าง index ครั้งแรกด้วย `npm run rag:reindex` (รันซ้ำได้) หรือ `npm run db:seed` สำหรับข้อมูล demo หากมีการแก้ข้อมูลด้วย SQL โดยตรง ให้รัน `npm run rag:reindex` อีกครั้ง เพราะทางลัดนี้ไม่ผ่านกลไกอัปเดต index ของ API

ทดลองได้ในหน้า **LINE Simulator** หรือ `POST /api/v1/shops/{shopId}/line/simulate` โดยใช้บัญชีเจ้าของร้าน หน้า Simulator แสดงวิธีตอบและรหัสแหล่งความรู้ใต้คำตอบ ปุ่ม **ค้นข้อมูลสินค้า** ใช้คำถามที่ไม่ตรง FAQ เพื่อให้เห็นขั้นค้น chunks (`shop-coffee`: ลาเต้เย็นราคาเท่าไหร่; `shop-flower`: ช่อกุหลาบราคาเท่าไหร่) ผล API มี `reply_method` (`faq`, `extractive`, `generator`, `no_evidence`) และ `reply_source_ids` ส่วนข้อความ LINE จริงบันทึกหลักฐานไว้ใน `message_sources` (`shop_id`, `message_id`, `knowledge_entry_id`, `chunk_id`, `source_excerpt`) แม้ภายหลังลบความรู้นั้นไปแล้ว คำตอบที่ส่งไม่สำเร็จจะไม่ถูกบันทึกเป็นข้อความผู้ช่วย

ตั้ง `BUDDYSHARE_API_KEY` ใน `.env` บนเครื่องเพื่อใช้ Gemini ผ่าน BuddyShare Responses API เป็น AI หลัก (`BUDDYSHARE_MODEL=gemini-3.1-flash-lite`) คีย์ BuddyShare ใช้กับ Google endpoint โดยตรงไม่ได้ หากมี Google Gemini API key แท้จึงใช้ `GEMINI_API_KEY` และ `GEMINI_MODEL` แทนได้ เมื่อมี `OPENAI_API_KEY` ระบบใช้ OpenAI เป็น AI สำรอง รุ่นเริ่มต้น `gpt-5.6-luna`; เปลี่ยนได้ด้วย `OPENAI_MODEL` หลังตรวจสิทธิ์และราคาแล้ว ข้อมูลคำถามและหลักฐานของร้านที่เลือกจะส่งผ่าน BuddyShare ซึ่งเป็นบริการตัวกลางภายนอก

แต่ละบริการลองซ้ำได้หนึ่งครั้งเฉพาะ timeout/network/429/5xx โดยเว้น 150 ms และจำกัดเวลารวม 8.5 วินาที หากบริการล้มซ้ำสองคำขอจะพัก 30 วินาทีแล้วลองใหม่หนึ่งครั้ง สถานะนี้อยู่ใน process เดียว ไม่แชร์ระหว่างหลาย instance คำตอบที่ไม่ตรงหลักฐานจะถูกปฏิเสธแล้วลองสำรอง หากทั้งคู่ใช้ไม่ได้ ระบบตอบด้วยข้อความจากหลักฐานในเครื่องหรือแจ้งว่าไม่มีข้อมูลยืนยัน ไม่ส่งข้อมูลจากร้านอื่น

หากมีบริการ AI ของตนเองและไม่ได้ตั้งคีย์สองรายข้างต้น ยังใช้ `RAG_GENERATOR_URL`/`RAG_GENERATOR_TOKEN` แบบเดิมได้ worker ส่ง `POST` JSON `{ shopId, query, context, instruction, prompt }` โดย `context` มีเฉพาะ chunk ของร้านที่เกี่ยวข้อง บริการตอบ `{ "text": "จัดส่งภายในเมือง ค่าจัดส่ง 50 บาท", "sourceChunkIds": ["shop-flower-kb-3:0"] }` หรือ `{ "insufficient": true }` คำตอบต้องคัดตรงจาก chunk ที่อ้างอิง Local embedding เป็น character n-gram hashing ซึ่งความแม่นยำเชิงความหมายมีข้อจำกัด ควรตรวจคำถามของร้านก่อนใช้งานจริง

การเปลี่ยน `bot_mode` จะถูกตรวจอีกครั้งหลังเตรียมคำตอบและก่อนส่ง LINE Endpoint บันทึกข้อความไม่ใช่หลักฐานว่าส่งถึง LINE แล้ว

ดู [รีวิวระยะ G](PLAN/phase-g-review.md) และ [วิธีดูแลคิว LINE](docs/line-jobs.md) สำหรับงานระบบ การรัน local ครั้งนี้ใช้ LINE Simulator จึงยังไม่มี webhook จาก LINE จริง

ก่อนสาธิตให้ทำตาม [คู่มือสาธิตและตรวจความพร้อม](docs/demo-runbook.md) รวมผลตรวจ PostgreSQL, AI failover, LINE, Handover และรายงานที่ยังต้องวัดจากบริการจริง

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

Imported LINE events คง raw history และรายงาน received/processing เป็น unresolved ไม่สร้าง jobs หรือส่ง LINE reply เก่า Snapshot ยังคงมีข้อมูลลับทั้งหมด ต้องเก็บในพื้นที่จำกัดสิทธิ์ ปัจจุบันไม่มีไฟล์ SQLite เดิม จึงเริ่มฐาน PostgreSQL ใหม่บนเครื่อง

หาก connection ขาดระหว่าง COMMIT รายงานจะระบุ `commit-uncertain` ให้รัน verify กับ target เดิมก่อนตัดสินใจ ห้ามล้างฐานหรือ import ทับ ถ้า commit สำเร็จแต่เขียนรายงานสุดท้ายไม่สำเร็จ อาจเหลือ receipt `verified-before-commit`; ใช้ verify เพื่อยืนยันผล

## บทสนทนา สถิติ และแอดมินรับช่วง (งานข้อ 9–10)

เปิดร้านแล้วเลือกแท็บ **บทสนทนาและสถิติ** เพื่ออ่านประวัติ ค้นหา/กรองห้อง ดูสถานะบอท และยอดรวมจริงแยกตามร้าน รองรับแบ่งหน้ารายการห้องและข้อความ พร้อมอัปเดตทุก 15 วินาทีขณะเปิดหน้า สถิติรวมข้อมูลทั้งหมดของร้าน ไม่เปลี่ยนตามตัวกรองห้อง และ “ส่งต่อแอดมินปัจจุบัน” ไม่ใช่ยอดการส่งต่อสะสม ดูวิธีใช้และนิยามตัวเลขใน [docs/conversations.md](docs/conversations.md)

ข้อ 10 เพิ่ม **รับช่วงสนทนา / Pause / Resume** และช่องพิมพ์ส่งจริงไป LINE พร้อมสถานะการส่งและ request ID ป้องกันซ้ำ บอทไม่ตอบแทรกขณะพัก และ Resume ไม่ย้อนส่งคำตอบ AI ค้าง ก่อนใช้ให้หยุดรุ่นเก่าแล้วรัน `npm run db:migrate:postgres` เพื่อเพิ่ม migration 005 รายละเอียดการจัดการ unknown/timeout และขั้นตอน deploy อยู่ในคู่มือข้างต้น

## ทดสอบรวมและวัดคุณภาพ (งานข้อ 11)

ใช้ `TEST_DATABASE_URL` ตาม PostgreSQL test fixture (loopback / ฐาน chatbot_test แยกจาก runtime) แล้วรัน `npm run test:evaluation` เพื่อสร้างผลคำถามเทียบเฉลย Failover Handover และเวลาใน `reports/task11/` หลัง `npm run build` รัน `npm run test:browser` เพื่อตรวจ production frontend ด้วย Chrome ที่ติดตั้งในเครื่อง หรือกำหนด `PLAYWRIGHT_CHANNEL=chromium` หลัง `npx playwright install chromium`

วิธีรัน เกณฑ์คะแนน หลักฐานก่อน/หลังแก้ และข้อจำกัดการวัดอยู่ใน [docs/task11-review.md](docs/task11-review.md) ผลนี้เป็น fixtures ไม่ใช่ความแม่นยำบนลูกค้าจริงหรือค่าใช้จ่าย production; คะแนนมนุษย์เว้นว่างใน `human-review.csv`

## Repository

โปรเจกต์มี Git repository และ origin แล้ว วิธีเปิดระบบปัจจุบันอยู่ใน `docs/local-run.md` และลำดับสาธิตอยู่ใน `docs/demo-runbook.md`
