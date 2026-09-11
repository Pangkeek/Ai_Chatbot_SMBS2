# SMB Chatbot Platform — โครงสร้างเริ่มต้น

Backend สำหรับทีมพัฒนาแพลตฟอร์ม Chatbot หลายร้าน มีฐานข้อมูลจริง, REST API, ERD, OpenAPI และข้อมูลทดสอบ 2 ร้าน รันได้โดยไม่ต้องใช้ API key หรือบริการภายนอก

## รันครั้งแรก

ต้องมี **Node.js 24.19.0 ขึ้นไปในสาย 24.x** และ Git ระบบใช้ `node:http`, `node:sqlite` และ `node:test` ที่มากับ Node จึงไม่มี package ภายนอกให้ติดตั้ง

เปิด terminal ในโฟลเดอร์โครงการแล้วรัน:

```powershell
node --version
node --env-file-if-exists=.env scripts/migrate.mjs
node --env-file-if-exists=.env scripts/seed.mjs
node --env-file-if-exists=.env src/server.mjs
```

เปิด **http://127.0.0.1:3000/docs** เพื่อใช้ API Console และ **http://127.0.0.1:3000/health** เพื่อตรวจการเชื่อมต่อฐานข้อมูล หยุด server ด้วย `Ctrl+C`

ใช้คำสั่งเดียวกันได้บน Windows, macOS และ Linux ถ้าติดตั้ง Node แบบที่มี npm สามารถใช้ `npm run db:migrate`, `npm run db:seed`, `npm start`, `npm run dev` และ `npm test` ได้ด้วย

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
- [สัญญา API และตัวอย่าง workflow](docs/api.md)
- [OpenAPI 3.1 สำหรับนำเข้า Postman / Swagger Editor](docs/openapi.json)
- [สถาปัตยกรรม ขอบเขต และจุดเชื่อมต่อระยะถัดไป](docs/architecture.md)
- [วิธีทำงานร่วมกันและเกณฑ์รับงาน](CONTRIBUTING.md)

`src/contracts.mjs` เป็นแหล่งกำหนด contract v0.1.0 ทั้ง routing, การตรวจ request และ OpenAPI ที่ server ให้บริการ ส่วน `docs/openapi.json` คือสำเนาที่สร้างจากแหล่งเดียวกัน ทีมสามารถใช้เป็น baseline ในการพัฒนาและทบทวนร่วมกันก่อนเปลี่ยน contract

## โครงสร้าง repository

```text
.github/workflows/ci.yml  ตรวจ test และความตรงกันของ OpenAPI
migrations/              SQL migrations ตามลำดับ พร้อม checksum
src/
  server.mjs             อ่าน config และเปิด HTTP server
  app.mjs                routing, auth, tenant scope, validation, error envelope
  contracts.mjs          request/response schemas และ endpoint registry
  service.mjs            business rules และคำสั่งฐานข้อมูล
  db.mjs                 เปิด SQLite และใช้ migration
  auth.mjs               password hashing และ session token
  seed.mjs               ข้อมูลสมมติ 2 ร้าน
  validation.mjs         schema validator และ API errors
scripts/                 migrate, seed, สร้าง OpenAPI
public/                  API Console สำหรับนักพัฒนา
tests/                   HTTP integration และ database tests
docs/                    ERD, API, architecture, OpenAPI
data/                    ฐานข้อมูล local (ไม่เก็บใน Git)
```

## Configuration

ค่าเริ่มต้นใช้งานได้ทันที ถ้าต้องการแก้ไขให้คัดลอก `.env.example` เป็น `.env` แล้วปรับค่า:

| ตัวแปร | ค่าเริ่มต้น | ความหมาย |
|---|---|---|
| HOST | 127.0.0.1 | รับการเชื่อมต่อภายในเครื่อง |
| PORT | 3000 | พอร์ต HTTP |
| DATABASE_PATH | ./data/chatbot.sqlite | พาธฐานข้อมูล คิดจากโฟลเดอร์ที่รันคำสั่ง |

`.env`, ฐานข้อมูล, log และไฟล์ชั่วคราวถูกตัดออกจาก Git หากพอร์ตถูกใช้ให้เปลี่ยน `PORT` และเปิด URL ตามพอร์ตใหม่ หากต้องการฐานข้อมูลทดสอบชุดใหม่ให้ตั้ง `DATABASE_PATH` เป็นไฟล์ใหม่แล้วรัน seed

## ตรวจงาน

```powershell
node --test
node scripts/openapi.mjs --check
```

Test ตรวจทุก endpoint ที่ประกาศไว้ รวมถึง tenant isolation, สิทธิ์ owner/agent, session หมดอายุและ logout, input validation, การส่งต่อเจ้าหน้าที่, foreign keys, seed ซ้ำ และข้อมูลคงอยู่หลังเปิดฐานข้อมูลใหม่ ใช้ฐานข้อมูลในหน่วยความจำหรือโฟลเดอร์ชั่วคราว ไม่แตะฐานข้อมูลพัฒนา

เมื่อแก้ contract ให้รัน `node scripts/openapi.mjs` และ commit ไฟล์ที่สร้างใหม่ไปด้วย CI ถูกเตรียมไว้สำหรับ push/PR หลังนำ repository ขึ้น GitHub

## สิ่งที่พร้อมและงานระยะถัดไป

พร้อมใช้: สมัครสมาชิก/เข้าสู่ระบบ, จัดการร้าน, CRUD ความรู้, ประวัติบทสนทนา/ข้อความ, เปลี่ยนสถานะ bot และ console ทดลอง API ข้อมูลถูกเก็บใน SQLite จริง

งานต่อยอด: Dashboard สำหรับผู้ประกอบการ, LINE webhook/ส่งข้อความจริง, RAG/embedding, Gemini/OpenAI gateway และ failover การเปลี่ยน `bot_mode` ตอนนี้เป็นการบันทึกสถานะและตรวจเงื่อนไขเจ้าหน้าที่ตอบ ยังไม่มี AI worker ที่ทำงานเบื้องหลัง Endpoint บันทึกข้อความไม่ใช่หลักฐานว่าส่งถึง LINE แล้ว

SQLite เหมาะสำหรับเริ่มพัฒนาแบบหนึ่ง process; แผนขยายไป PostgreSQL และข้อกำหนด tenant scope อยู่ในเอกสารสถาปัตยกรรม บัญชี demo และ API จำลองลูกค้าใช้สำหรับพัฒนาภายในเครื่อง

## Repository

โฟลเดอร์นี้เริ่มต้นเป็น Git repository ในเครื่องแล้ว ยังไม่มี remote เนื่องจากยังไม่ได้ระบุบัญชีหรือ URL ของทีม เมื่อต้องการเผยแพร่ ให้สร้าง remote ของทีมแล้วเชื่อม repository นี้ตามขั้นตอนใน `CONTRIBUTING.md`
