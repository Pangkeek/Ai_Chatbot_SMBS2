# สถานะเตรียมสาธิต — 20 ตุลาคม 2026

## สิ่งที่ตรวจในเครื่อง

- Runtime ใช้ PostgreSQL 18; ไม่มีไฟล์ SQLite ต้นทางอยู่ในเครื่องผู้ใช้ จึงเริ่มฐานสาธิตใหม่ ไม่อ้างว่าได้ย้ายข้อมูลเดิม
- Node 24.19.0 และ npm 11.19.0 ตรงกับโปรเจกต์; `npm ci` ผ่าน และ `npm audit --audit-level=high` พบ 0 vulnerabilities ในรอบนี้
- Gateway Gemini หลัก/OpenAI สำรองมี timeout, retry/backoff, circuit breaker และตรวจข้อความกับหลักฐานก่อนรับผล ทดสอบด้วย HTTP doubles ไม่ได้เรียกบัญชีจริง
- `test:runtime` บนโค้ดสุดท้าย 108/108 ผ่าน รวมชุด AI gateway, RAG และ LINE Simulator ที่บันทึกคำตอบของ AI สำรองพร้อมแหล่งอ้างอิง
- `test:sqlite` 3/3, `test:import` 8/8, `test:postgres` 2/2, `test:postgres:schema` 3/3, `test:line:runtime` 1/1, `test:production` 2/2 ผ่าน
- `test:evaluation` ล่าสุด: คำถาม 28/28, failover HTTP fixture 7/7, handover 7/7; latency local p50 84.45 ms, p95 142.11 ms ตาม `reports/task11/results.json` ไม่รวมเครือข่าย LINE/AI จริง
- `test:browser` 11 ขั้นตอนผ่าน, page errors 0, ตรวจภาพ desktop/mobile แล้ว; `npm run build` และ `npm run api:check` ผ่าน
- สร้างฐาน `chatbot_demo` แยกใน PostgreSQL ชั่วคราว, migrations 001–005 ผ่าน, seed ข้อมูลสมมติสองร้าน, เปิด Next แบบ development ที่ `http://127.0.0.1:3131` และ `demo:preflight` ได้ HTTP 200 ทั้ง 4 เส้นทาง; login ร้านดอกไม้, รายการร้าน, AI preview ที่มีหลักฐาน 1 รายการ และ LINE Simulator ที่ตอบ `extractive` พร้อมแหล่งอ้างอิง 1 รายการผ่าน

## สิ่งที่ยังขาดก่อนอ้างว่าเป็นระบบใช้งานจริง

1. ยังไม่มี Render staging/production หรือ LINE test channel ตามคำตอบผู้ใช้ จึงไม่มี URL ภายนอกหรือผลส่งถึงอุปกรณ์จริง
2. ยังไม่กำหนด API keys, สิทธิ์โมเดล หรือ budget ของ Gemini/OpenAI; ต้องทดสอบทั้งสอง API จริงและบันทึก tokens, ราคา และเวลาเครือข่ายหลังตั้งค่า
3. `reports/task11/human-review.csv` ยังต้องให้คนให้คะแนนคำตอบจริง; ผลอัตโนมัติไม่แทนคะแนนมนุษย์
4. ต้องเลือกบริการ/แผนค่าใช้จ่าย, ตั้ง secret store, backup/restore, ตรวจ persistence หลัง redeploy และผ่าน staging gate ใน `docs/render-staging.md` ก่อนเปิด LINE จริง
5. Docker PostgreSQL สำหรับรอบตรวจนี้เป็นคอนเทนเนอร์ `--rm` แยก ไม่มี volume ถาวร ไม่ใช่ฐาน deploy หรือ backup ของผู้ใช้

ลำดับสาธิตและรายการหลักฐานอยู่ใน `docs/demo-runbook.md` คำตอบและภาพจากการทดสอบอัตโนมัติอยู่ใน `reports/task11/`
