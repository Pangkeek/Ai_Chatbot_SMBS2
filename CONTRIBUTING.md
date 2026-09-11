# วิธีทำงานร่วมกัน

## เริ่มพัฒนา

1. ใช้ Node ตาม `.nvmrc` และรันตาม README
2. ใช้ SQLite คนละไฟล์ภายในเครื่อง ไม่ commit `data/` หรือ `.env`
3. แบ่ง branch ตามงาน เช่น `feature/dashboard`, `feature/line-webhook`, `feature/rag`
4. ใช้ OpenAPI v0.1.0 เป็น baseline; ทบทวน semantics กับทีมก่อนเปลี่ยน contract ที่ frontend ใช้แล้ว
5. ก่อนส่ง PR รัน `node --test` และ `node scripts/openapi.mjs --check`

## กฎสำหรับการแก้ไข

- เพิ่ม SQL migration ใหม่แทนแก้ไฟล์ที่เคย apply แล้ว ระบบตรวจ checksum และหยุดหากไฟล์เก่าถูกเปลี่ยน
- ทุก tenant endpoint ตรวจ membership และทุก query ใช้ shop_id แม้มี resource ID อยู่แล้ว
- การสร้างร้านกับ owner membership และการเพิ่มข้อความกับการอัปเดต conversation ต้องเป็น transaction
- ห้ามเพิ่ม role `assistant/system` ให้ client เขียนได้โดยตรง สร้างผ่าน internal worker ที่ตรวจ scope และ bot state
- ใช้ bound SQL parameters สำหรับข้อมูลภายนอก และ whitelist ชื่อ column ผ่าน contract
- แก้ contract/implementation/test/docs ใน PR เดียวกัน จากนั้นรัน `node scripts/openapi.mjs`
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

## เมื่อต้องการนำขึ้น remote

สร้าง repository ว่างในบัญชีของทีมก่อน จากนั้นทำ initial commit และเชื่อม remote ของจริง:

```text
git add .
git commit -m "Initialize chatbot foundation"
git branch -M main
git remote add origin <TEAM_REPOSITORY_URL>
git push -u origin main
```

แทน `<TEAM_REPOSITORY_URL>` ด้วย URL ที่ทีมเลือก ไม่มีการตั้ง remote หรือ push อัตโนมัติในงานนี้ CI ใน `.github/workflows/ci.yml` จะทำงานเมื่อ repository อยู่บน GitHub
