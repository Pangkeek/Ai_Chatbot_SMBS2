# คู่มือตรวจความพร้อมและสาธิต

สถานะ ณ 20 ตุลาคม 2026: ระบบใช้ PostgreSQL เป็น runtime อยู่แล้ว ผู้ใช้ยืนยันว่าไม่มีไฟล์ SQLite ต้นทาง จึงใช้ฐาน PostgreSQL ใหม่สำหรับการสาธิต ไม่ทำ import ข้อมูลเก่า ไม่สร้างบริการ Render หรือ LINE channel จากคู่มือนี้โดยอัตโนมัติ

## 1. เตรียมฐานและ release

1. ใช้ Node 24.19.0, npm 11.19.0 และ PostgreSQL 18; ตั้ง `DATABASE_URL` ไปยังฐาน **สาธิต** ที่ตั้งใจใช้ และ `TEST_DATABASE_URL` ไปยังฐาน `chatbot_test` แยกกัน
2. ตั้ง `DB_SSL_MODE` ให้ตรงกับการเชื่อมต่อ และเก็บ credentials ใน secret store ของ host ห้าม commit `.env`
3. รัน `npm ci`, `npm run check:toolchain`, `npm run db:migrate`, `npm run rag:reindex`, `npm run build` ตามลำดับ ตรวจ exit code ทุกขั้น ก่อนเปิด worker
4. ใช้ข้อมูลสมมติ: `npm run db:seed` เฉพาะ local/development; production seed ถูกปฏิเสธ สมัครบัญชีและสร้างร้านผ่านหน้าเว็บแทน
5. ก่อนเปิด LINE จริง ตรวจ backup/restore บนฐานแยกและขั้น cutover ใน [production-cutover.md](production-cutover.md)

สำหรับการซ้อมบนเครื่องหลังเตรียมฐาน local ให้ตั้ง `LINE_WORKER_ENABLED=false` แล้วรัน `npm run dev -- --port 3131` เปิด `http://127.0.0.1:3131` และใช้ LINE Simulator ในหน้าตั้งค่าร้าน ทดสอบ webhook/การส่ง LINE จริงไม่ได้จาก localhost เมื่อใช้ข้อมูล seed ให้เปิดเฉพาะเครื่องตัวเอง

## 2. ตรวจอัตโนมัติ

```powershell
npm run test:sqlite
npm run test:runtime
npm run test:evaluation
npm run test:import
npm run test:postgres
npm run test:postgres:schema
npm run test:line:runtime
npm run test:production
npm run api:check
npm run build
npm run test:browser
npm audit --audit-level=high
npm run demo:preflight -- http://127.0.0.1:3000
```

`demo:preflight` ทำ GET แบบอ่านอย่างเดียวกับ health, หน้าแอป และ OpenAPI ของ URL ที่ระบุ; URL ภายนอกต้องเป็น HTTPS ผลผ่านนี้ไม่แทนการตรวจ login, ข้อมูลร้าน, LINE หรือ AI จริง เก็บ commit SHA, เวลาทดสอบ, ผลคำสั่ง และข้อผิดพลาดที่พบในรายงาน

## 3. ลำดับสาธิตบนระบบที่เตรียมแล้ว

1. สมัครบัญชี → สร้างร้าน → ตั้งชื่อ ประเภทธุรกิจ สินค้า/บริการ และเวลาเปิด
2. เพิ่ม FAQ สถานะ `published` และรายการ `draft` ถามคำถามที่ตรง FAQ แล้วแสดงว่าร่างไม่ถูกใช้
3. เปิดหน้าดูข้อมูลที่บอทใช้ตอบ แสดงแหล่งอ้างอิงจากร้านนั้นและกรณีไม่มีหลักฐาน
4. ตั้งค่า LINE test channel แยกจาก channel จริงใน LINE Developers Console เปิด webhook และตรวจ URL ด้วยปุ่มในแอป ตั้ง `LINE_WORKER_ENABLED=true` บน instance ที่ประมวลผลงาน
5. ส่งข้อความจาก LINE test account ไปที่ร้าน ตรวจข้อความ customer และ assistant ในหน้าบทสนทนาและบนโทรศัพท์ เทียบ event ID เพื่อยืนยันว่า webhook ซ้ำไม่ส่งข้อความซ้ำ
6. รับช่วงโดยแอดมิน ส่งข้อความผ่าน LINE แล้วทดสอบ Pause → ส่งคำถามขณะพัก → Resume → ส่งคำถามใหม่ ตรวจว่าบอทไม่ตอบแทรกหรือย้อนตอบงานเก่า
7. หากเปิด `GEMINI_API_KEY`/`OPENAI_API_KEY` ให้บันทึกผลของโมเดลหลักและการสลับไปสำรองจากสภาพทดสอบที่ควบคุมได้; อย่าทำให้บริการจริงของลูกค้าล้มเพื่อสาธิต ใช้ชุดทดสอบอัตโนมัติแทน

## 4. สิ่งที่ต้องกรอกในรายงานก่อนอ้างว่าใช้งานจริงผ่าน

| หลักฐาน | สิ่งที่บันทึก |
|---|---|
| Release | commit SHA, URL, ชื่อ Web Service/DB, เวลา deploy และผู้ตรวจ โดยไม่ใส่ secret |
| คุณภาพคำตอบ | คะแนนคนใน `reports/task11/human-review.csv` และตัวอย่างที่ผิด/แก้แล้ว |
| AI | รุ่นโมเดลจริง, คำขอหลัก/สำรอง, input/output tokens, latency p50/p95, ราคา/ค่าใช้จ่ายจาก usage จริง |
| LINE | channel ทดสอบ, เวลา, event/request ID, ข้อความถึงอุปกรณ์, DB customer/assistant, ผลการส่งซ้ำ |
| Handover | เวลารับช่วง/ส่ง agent/Pause/Resume และหลักฐานว่าบอทไม่ตอบแทรก |
| ข้อมูล | migration version, backup และผล restore rehearsal บนฐานแยก, persistence หลัง restart |
| ข้อจำกัด | สิ่งที่ยังไม่ทดสอบจริง รวม browser/device, ภาระงาน และค่า hosting |

หากไม่มีบริการ staging และ LINE test channel ให้ใช้ local PostgreSQL กับตัวส่งจำลองเพื่อซ้อม flow ได้ แต่รายงานต้องระบุชัดว่าเป็นผลจำลอง ไม่ถือว่าผ่าน production cutover หรือ LINE จริง
