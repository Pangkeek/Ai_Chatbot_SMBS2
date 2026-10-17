# วิธีทำงานร่วมกัน

## เริ่มพัฒนา

1. ใช้ Node ตาม `.nvmrc` และรันตาม README
2. ใช้ PostgreSQL 18 แยก dev/test DB; tests ใช้ TEST_DATABASE_URL และ schema สุ่ม ไม่ commit `data/` หรือ `.env`
3. แบ่ง branch ตามงาน เช่น `feature/dashboard`, `feature/line-webhook`, `feature/rag`
4. ใช้ OpenAPI v0.1.0 เป็น baseline; ทบทวน semantics กับทีมก่อนเปลี่ยน contract ที่ frontend ใช้แล้ว
5. ใช้ Node 24.19.0/npm 11.19.0 ตาม .nvmrc/packageManager; ตรวจด้วย `npm run check:toolchain` และติดตั้งด้วย `npm ci`
6. ก่อนส่ง PR รัน `npm test`, `npm run test:postgres`, `npm run test:postgres:schema`, `npm run build`, `npm run test:line:runtime`, `npm run test:production` (สองคำสั่งท้ายหลัง build) และ `npm run api:check`
7. CI แยก `test:sqlite` (SQLite fixtures), `test:runtime` (PostgreSQL/API/UI unit tests), `test:import` (SQLite→PostgreSQL) หากเพิ่มไฟล์ test ให้เพิ่มใน script กลุ่มที่เกี่ยวข้องเพื่อให้ CI ครอบคลุมเหมือน `npm test`

## กฎสำหรับการแก้ไข

- เพิ่ม SQL migration ใหม่แทนแก้ไฟล์ที่เคย apply แล้ว ระบบตรวจ checksum และหยุดหากไฟล์เก่าถูกเปลี่ยน
- ทุก tenant endpoint ตรวจ membership และทุก query ใช้ shop_id แม้มี resource ID อยู่แล้ว
- การสร้างร้านกับ owner membership และการเพิ่มข้อความกับการอัปเดต conversation ต้องเป็น transaction
- ห้ามเพิ่ม role `assistant/system` ให้ client เขียนได้โดยตรง สร้างผ่าน internal worker ที่ตรวจ scope และ bot state
- ใช้ bound SQL parameters สำหรับข้อมูลภายนอก และ whitelist ชื่อ column ผ่าน contract
- แก้ contract/implementation/test/docs ใน PR เดียวกัน จากนั้นรัน `node scripts/openapi.js`
- เพิ่มการทดสอบพฤติกรรมที่เสี่ยงเสียหาย เช่น ข้อมูลข้ามร้าน, retry ซ้ำ, สถานะ handover และ authorization

## เกณฑ์รับงาน foundation

- [x] มี local Git repository และโครงสร้างไฟล์ที่แบ่งหน้าที่ชัดเจน
- [x] มีคำสั่ง migrate / seed / start และ .env.example
- [x] มี schema จริงสำหรับผู้ใช้ ร้าน ความรู้ บทสนทนา และข้อความ
- [x] มี ERD, foreign keys, index และ API contract จากแหล่งเดียว
- [x] มีข้อมูลทดสอบ 2 ร้าน พร้อมบัญชีแยกร้าน
- [x] ทดสอบ HTTP endpoints, tenant isolation, seed ซ้ำและ persistence
- [ ] ทีมทบทวนและยืนยัน baseline v0.1.0 ร่วมกัน
- [ ] เชื่อม remote repository ของทีมตามบัญชี/URL ที่เลือก

สองรายการท้ายต้องอาศัยการเลือกและการทบทวนของทีม ไม่ใช่ผลที่ automated test ยืนยันได้

## เมื่อต้องการส่ง release ของ migration

Repository มี origin แล้ว ตรวจ diff และเลือกไฟล์ที่ต้องการก่อน commit งาน ไม่ใส่ .env, snapshots หรือ data ขั้นตอนตัวอย่างบน branch งานปัจจุบัน:

```text
git add .
git commit -m "Migrate persistence to PostgreSQL and prepare Render deployment"
git push -u origin codex/postgresql-render-migration
```

เลือก branch ให้ตรงกับงานที่ตั้งใจส่ง ไม่เปลี่ยน main อัตโนมัติ งานนี้ยังไม่ได้ commit/push หรือรัน GitHub Actions remote หลัง CI ผ่านผู้ใช้จึงเลือก release commit และดำเนินการ Render ตาม [คู่มือ staging](docs/render-staging.md)

## Notin แผนงาน

https://app.notion.com/p/AI-Chatbot-SMBs-3d8d1e39ec9c81158d17e529e229f350
