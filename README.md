# SMB Chatbot Platform — Next.js

เว็บแอป Next.js สำหรับจัดการ Chatbot หลายร้าน พร้อม REST API, SQLite, OpenAPI และข้อมูลทดสอบ 2 ร้าน รันได้โดยไม่ต้องใช้ API key หรือบริการภายนอก

## รันครั้งแรก

ต้องมี **Node.js 24.19.0 ขึ้นไปในสาย 24.x** และ **npm 11.19.0** ติดตั้งแพ็กเกจด้วยคำสั่ง:

เปิด terminal ในโฟลเดอร์โครงการแล้วรัน:

```powershell
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

เปิด **http://127.0.0.1:3000/** เพื่อเข้าสู่หน้าแนะนำ `/home` ก่อนล็อกอิน จากนั้นกด **เข้าสู่ระบบ** หรือ **จัดการร้านค้า** เพื่อไป `/app` กด **สมัครสมาชิก** เพื่อเปิดแบบฟอร์มสร้างบัญชีโดยตรง ส่วน **http://127.0.0.1:3000/docs** ใช้ API Console และ **http://127.0.0.1:3000/health** ใช้ตรวจการเชื่อมต่อฐานข้อมูล หยุด server ด้วย `Ctrl+C`

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

ลิงก์จากหน้าแนะนำพาไป `/app` เพื่อใช้ขั้นตอนเข้าสู่ระบบเดิมของแดชบอร์ด หากยังไม่มีบัญชีให้ไป `/app?mode=register` เพื่อเปิดแท็บสมัครสมาชิก หน้าข้อมูลร้านและการเชื่อมต่อ LINE ต้องเลือกจากร้านที่บัญชีมีสิทธิ์เข้าถึง

หน้า `/home` อธิบายฟีเจอร์และเส้นทางที่ใช้งานได้ในปัจจุบัน พร้อมแยกหน้า **บทสนทนาและสถิติ** และ **แอดมินรับช่วงตอบ** เป็นแผนพัฒนาตาม [หน้าโครงการใน Notion](https://app.notion.com/p/AI-Chatbot-SMBs-3d8d1e39ec9c81158d17e529e229f350) โดยยังไม่มีลิงก์ไปยังหน้าที่ไม่ได้สร้าง
ภาพอินโฟกราฟิก, FAQ, LINE และ Webhook ที่ใช้ในหน้าแรกอยู่ใน `public/assets/home/` ส่วนสีและลายพื้นหลังของหน้าแรกกำหนดไว้ใน `src/styles/globals.css` ภายใต้ `.home-page` เพื่อไม่กระทบหน้าแดชบอร์ด

เปิด URL ของร้านโดยตรงหรือรีเฟรชหน้าได้ ระบบจะให้เข้าสู่ระบบก่อนหากยังไม่มี session และตรวจสิทธิ์ร้านผ่าน API ก่อนแสดงข้อมูล

สำหรับ production ให้รัน `npm run build` แล้วจึง `npm start` Next.js จะสร้างหน้าเว็บและ Tailwind CSS ในขั้น build หน้าเว็บและ REST API ให้บริการจาก origin เดียวกัน สไตล์ของหน้าเว็บอยู่ใน utility classes ของ JSX โดย `src/styles/globals.css` มีเพียงการนำเข้า Tailwind และตั้งค่าฟอนต์

| ร้านทดสอบ | อีเมล | รหัสผ่าน | shopId |
|---|---|---|---|
| บ้านกาแฟ | coffee@example.test | DemoPass!2026 | shop-coffee |
| บ้านดอกไม้ | flower@example.test | DemoPass!2026 | shop-flower |

แต่ละร้านมีเจ้าของ 1 คน ความรู้ 3 รายการ บทสนทนา 1 รายการ และข้อความ 2 รายการ ลูกค้าทั้งสองร้านใช้ external ID เดียวกันโดยตั้งใจ เพื่อทดสอบว่าระบบไม่รวมข้อมูลข้ามร้าน ข้อความ assistant ใน seed เป็นข้อมูลตัวอย่างที่เขียนไว้ล่วงหน้า

`seed` รันซ้ำได้โดยไม่สร้างแถวซ้ำหรือเขียนทับแถวที่มีอยู่ หากลบข้อมูลตัวอย่างบางแถวแล้วรัน seed แถวนั้นจะถูกเติมกลับ Startup ปกติรัน migration อัตโนมัติ แต่ไม่เติม seed ให้อัตโนมัติ

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

## Configuration

ค่าเริ่มต้นใช้งานได้ทันที ถ้าต้องการแก้ไขให้คัดลอก `.env.example` เป็น `.env` แล้วปรับค่า:

| ตัวแปร | ค่าเริ่มต้น | ความหมาย |
|---|---|---|
| PORT | 3000 | พอร์ต HTTP |
| DATABASE_PATH | ./data/chatbot.sqlite | พาธฐานข้อมูล คิดจากโฟลเดอร์ที่รันคำสั่ง |

`.env`, ฐานข้อมูล, log และไฟล์ชั่วคราวถูกตัดออกจาก Git หากพอร์ตถูกใช้ให้เปลี่ยน `PORT` และเปิด URL ตามพอร์ตใหม่ หากต้องการฐานข้อมูลทดสอบชุดใหม่ให้ตั้ง `DATABASE_PATH` เป็นไฟล์ใหม่แล้วรัน seed

## ตรวจงาน

```powershell
npm test
npm run build
node scripts/openapi.js --check
```

Test ตรวจทุก endpoint ที่ประกาศไว้ รวมถึง tenant isolation, สิทธิ์ owner/agent, session หมดอายุและ logout, input validation, การส่งต่อเจ้าหน้าที่, foreign keys, seed ซ้ำ และข้อมูลคงอยู่หลังเปิดฐานข้อมูลใหม่ ใช้ฐานข้อมูลในหน่วยความจำหรือโฟลเดอร์ชั่วคราว ไม่แตะฐานข้อมูลพัฒนา

เมื่อแก้ contract ให้รัน `node scripts/openapi.js` และ commit ไฟล์ที่สร้างใหม่ไปด้วย CI ถูกเตรียมไว้สำหรับ push/PR หลังนำ repository ขึ้น GitHub

## สิ่งที่พร้อมและงานระยะถัดไป

พร้อมใช้: สมัครสมาชิก/เข้าสู่ระบบ, จัดการร้าน, CRUD ความรู้, ประวัติบทสนทนา/ข้อความ, เปลี่ยนสถานะ bot และ console ทดลอง API ข้อมูลถูกเก็บใน SQLite จริง

## ตรวจสอบ LINE จริง

ในแท็บ **การเชื่อมต่อ LINE** ให้บันทึก Channel Secret และ Channel Access Token ของ Messaging API ก่อน จากนั้นคัดลอก Webhook URL ไปตั้งที่ LINE Developers Console และเปิด **Use webhook** กด **ตรวจสอบกับ LINE** เพื่อเช็ก Token ด้วย `GET /v2/bot/info` เปรียบเทียบ Webhook URL และให้ LINE ส่ง webhook ทดสอบด้วย `POST /v2/bot/channel/webhook/test` สถานะ “เชื่อมต่อและตรวจสอบแล้ว” จะแสดงเมื่อทุกขั้นผ่านเท่านั้น

Webhook URL ต้องเป็น HTTPS ที่ LINE เข้าถึงได้จากอินเทอร์เน็ต การรันที่ `127.0.0.1` ทดสอบการส่ง webhook จริงไม่ได้ ส่วน **LINE Simulator** เป็นการจำลองภายใน ไม่ได้ส่งข้อความผ่าน LINE ค่าลับเก็บใน SQLite ของเครื่องและไม่ส่งกลับมาที่หน้าเว็บเป็นข้อความเต็ม

ระบบรับ webhook ตรวจลายเซ็นจาก raw body, กัน event ซ้ำ และส่งข้อความตอบกลับผ่าน LINE API ใน process เดียวกัน งานตอบกลับรันในคิวหน่วยความจำ จึงต้องใช้ worker/queue แบบคงทนก่อนใช้กับโฮสต์ที่หยุด process ทันทีหลังตอบ HTTP

## ค้นความรู้และตอบ LINE (งานข้อ 7)

ความรู้สถานะ `published` จะถูกแบ่งและทำ local embedding ลง `knowledge_chunks` เมื่อสร้างหรือแก้ผ่าน API/หน้า **FAQ/ข้อมูลความรู้** การเปลี่ยนเป็น `draft` และการลบจะเอาออกจาก index ทันที ตัวค้นกรอง `shop_id` และสถานะ `published` ใน SQL ก่อนจัดอันดับ คำถาม FAQ ที่ตรงชัดเจนใช้คำตอบเดิม ส่วนคำถามอื่นใช้ข้อความจากส่วนที่เกี่ยวข้อง ถ้าไม่พบหลักฐานจะตอบขอให้ติดต่อเจ้าหน้าที่

หลังอัปเกรดฐานข้อมูลเดิม ให้สร้าง index ครั้งแรกด้วย `npm run rag:reindex` (รันซ้ำได้) หรือ `npm run db:seed` สำหรับข้อมูล demo หากมีการแก้ข้อมูลด้วย SQL โดยตรง ให้รัน `npm run rag:reindex` อีกครั้ง เพราะทางลัดนี้ไม่ผ่านกลไกอัปเดต index ของ API

ทดลองได้ในหน้า **LINE Simulator** หรือ `POST /api/v1/shops/{shopId}/line/simulate` โดยใช้บัญชีเจ้าของร้าน หน้า Simulator แสดงวิธีตอบและรหัสแหล่งความรู้ใต้คำตอบ ปุ่ม **ค้นข้อมูลสินค้า** ใช้คำถามที่ไม่ตรง FAQ เพื่อให้เห็นขั้นค้น chunks (`shop-coffee`: ลาเต้เย็นราคาเท่าไหร่; `shop-flower`: ช่อกุหลาบราคาเท่าไหร่) ผล API มี `reply_method` (`faq`, `extractive`, `generator`, `no_evidence`) และ `reply_source_ids` ส่วนข้อความ LINE จริงบันทึกหลักฐานไว้ใน `message_sources` (`shop_id`, `message_id`, `knowledge_entry_id`, `chunk_id`, `source_excerpt`) แม้ภายหลังลบความรู้นั้นไปแล้ว คำตอบที่ส่งไม่สำเร็จจะไม่ถูกบันทึกเป็นข้อความผู้ช่วย

หากมีบริการ AI ของตนเอง ตั้ง `RAG_GENERATOR_URL` และ `RAG_GENERATOR_TOKEN` ใน `.env` เพื่อให้ worker ส่ง `POST` JSON `{ shopId, query, context, instruction }` ไปยังบริการนั้น `context` มีเฉพาะ chunk ของร้านที่เกี่ยวข้อง บริการต้องตอบ JSON เช่น `{ "text": "จัดส่งภายในเมือง ค่าจัดส่ง 50 บาท", "sourceChunkIds": ["shop-flower-kb-3:0"] }` โดย `text` ต้องคัดตรงจากเนื้อหา chunk ที่อ้างอิง หรือ `{ "insufficient": true }` เมื่อหลักฐานไม่พอ หากผลไม่ผ่านการตรวจ ระบบใช้ข้อความหลักฐานโดยตรงแทน จุด `generator.generate(...)` ยังฉีด implementation อื่นได้ **ถ้าไม่ได้ตั้ง URL ระบบทำเฉพาะ retrieval และตอบแบบคัดข้อความหลักฐาน จึงยังไม่มีขั้นสร้างคำตอบด้วย AI จริง** การเชื่อม Gemini/OpenAI, retry หรือ circuit breaker อยู่ในงานข้อ 8 Local embedding เป็น character n-gram hashing จึงไม่มีค่า API แต่ความแม่นยำด้านความหมายมีข้อจำกัด ควรตรวจคำถามตัวอย่างของร้านก่อนใช้งานจริง

การเปลี่ยน `bot_mode` จะถูกตรวจอีกครั้งหลังเตรียมคำตอบและก่อนส่ง LINE Endpoint บันทึกข้อความไม่ใช่หลักฐานว่าส่งถึง LINE แล้ว

SQLite เหมาะสำหรับเริ่มพัฒนาแบบหนึ่ง process; แผนขยายไป PostgreSQL และข้อกำหนด tenant scope อยู่ในเอกสารสถาปัตยกรรม บัญชี demo และ API จำลองลูกค้าใช้สำหรับพัฒนาภายในเครื่อง

## Repository

โฟลเดอร์นี้เริ่มต้นเป็น Git repository ในเครื่องแล้ว ยังไม่มี remote เนื่องจากยังไม่ได้ระบุบัญชีหรือ URL ของทีม เมื่อต้องการเผยแพร่ ให้สร้าง remote ของทีมแล้วเชื่อม repository นี้ตามขั้นตอนใน `CONTRIBUTING.md`
