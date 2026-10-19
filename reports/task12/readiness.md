# สถานะรันและเตรียมสาธิตบนเครื่อง — 20 ตุลาคม 2026

## สิ่งที่ตรวจในเครื่อง

- Runtime ใช้ PostgreSQL 18; ไม่มีไฟล์ SQLite ต้นทางอยู่ในเครื่องผู้ใช้ จึงเริ่มฐานสาธิตใหม่ ไม่อ้างว่าได้ย้ายข้อมูลเดิม
- Node 24.19.0 และ npm 11.19.0 ตรงกับโปรเจกต์; `npm ci` ผ่าน และ `npm audit --audit-level=high` พบ 0 vulnerabilities ในรอบนี้
- Gateway Gemini หลัก/OpenAI สำรองมี timeout, retry/backoff, circuit breaker และตรวจข้อความกับหลักฐานก่อนรับผล ทดสอบด้วย HTTP doubles ไม่ได้เรียกบัญชีจริง
- `test:runtime` บนโค้ดสุดท้าย 108/108 ผ่าน รวมชุด AI gateway, RAG และ LINE Simulator ที่บันทึกคำตอบของ AI สำรองพร้อมแหล่งอ้างอิง
- `test:sqlite` 3/3, `test:import` 8/8, `test:postgres` 2/2, `test:postgres:schema` 3/3, `test:line:runtime` 1/1, `test:production` 2/2 ผ่าน
- `test:evaluation` ล่าสุด: คำถาม 28/28, failover HTTP fixture 7/7, handover 7/7; latency local p50 84.45 ms, p95 142.11 ms ตาม `reports/task11/results.json` ไม่รวมเครือข่าย LINE/AI จริง
- `test:browser` 11 ขั้นตอนผ่าน, page errors 0, ตรวจภาพ desktop/mobile แล้ว; `npm run build` และ `npm run api:check` ผ่าน
- สร้างฐาน `chatbot_demo` แยกใน PostgreSQL ชั่วคราว, migrations 001–005 ผ่าน, seed ข้อมูลสมมติสองร้าน, เปิด Next แบบ development ที่ `http://127.0.0.1:3131` และ `demo:preflight` ได้ HTTP 200 ทั้ง 4 เส้นทาง; login ร้านดอกไม้, รายการร้าน, AI preview ที่มีหลักฐาน 1 รายการ และ LINE Simulator ที่ตอบ `extractive` พร้อมแหล่งอ้างอิง 1 รายการผ่าน
- หลังผู้ใช้เปลี่ยนเป็น local-only จัด `compose.local.yaml` แยกจาก Compose เดิม เปิด PostgreSQL 18.6 ที่ `127.0.0.1:55434` พร้อม volume `smb-chatbot-local_postgres_local_data` และฐาน `chatbot_local`/`chatbot_test`; migration 001–005 และ seed สองร้านผ่าน
- รีสตาร์ต PostgreSQL แล้วตรวจจำนวนร้านก่อน/หลังเท่ากัน 2/2; สำรอง `pg_dump` แบบ custom ลง `data/backups/chatbot_local.dump` (48,891 bytes) แล้ว `pg_restore` ลงฐานแยกและพบ 2 ร้าน จากนั้นลบเฉพาะฐานตรวจ restore
- `scripts/local-start.ps1` เปิดระบบซ้ำได้: toolchain Node 24.19.0/npm 11.19.0 ผ่าน, PostgreSQL healthy, migration ซ้ำ applied 0/unchanged 5, index 6 entries/6 chunks, Next พร้อมที่ `http://127.0.0.1:3131`; preflight 4/4 HTTP 200, login, เห็นร้านเดียว, Simulator processed/`extractive`/source 1 ผ่าน
- ทดสอบซ้ำบนฐาน local ถาวร: runtime 108/108, PostgreSQL 2/2 และ schema 3/3 ผ่าน
- เพิ่ม BuddyShare Responses API เป็นทางเลือกของ Gemini หลักจากคีย์ที่ผู้ใช้ส่งในภาพ โดยเก็บคีย์เฉพาะ `.env` ที่ Git ไม่ติดตาม; mock endpoint/schema/การส่งหลักฐานและการสลับไป OpenAI เมื่อ 401 ผ่าน; runtime รอบล่าสุด 110/110, build และ api:check ผ่าน
- ผู้ใช้คัดลอกคีย์จริงจาก BuddyShare ลง `.env` แล้ว `npm run ai:check` ผ่านกับ Gemini `gemini-3.1-flash-lite` โดยส่งเฉพาะข้อมูลสมมติ ไม่แสดงคีย์
- BuddyShare ส่งผล Chat Completions ที่มี JSON code fence กลับจาก `/v1/responses`; เพิ่มตัวอ่านเฉพาะ provider นี้ และยังตรวจข้อความกับหลักฐานทุกตัวอักษร
- เรียก RAG กับข้อมูลร้านดอกไม้ในฐาน local จริงได้ `generator` พร้อมหลักฐาน 1 แหล่ง คำถาม “ช่อกุหลาบราคาเท่าไหร่” ตอบตามข้อความฐานข้อมูล ใช้เวลาประมาณ 4.7 วินาที; หากโมเดลเติมข้อความที่ไม่มีในหลักฐาน ระบบยังตอบ `extractive`
- หลังแก้รอบนี้ `test:runtime` 111/111, `build`, `api:check`, `demo:preflight` 4/4 และ `ai:check` ผ่าน

## ขอบเขตที่ยังต้องมีคนหรือบริการจริง

1. ผู้ใช้เลือกรัน local เท่านั้น ไม่ต้องมี Render URL; ยังไม่มี LINE test channel/HTTPS webhook จึงไม่มีผลส่งถึงอุปกรณ์จริง
2. BuddyShare Gemini หลักผ่านการเรียกจริงแล้ว; ยังไม่มี OpenAI key สำหรับสำรอง จึงทดสอบการสลับด้วย HTTP doubles เท่านั้น และยังไม่ได้วัดค่าใช้จ่ายจริง
3. `reports/task11/human-review.csv` ยังต้องให้คนให้คะแนนคำตอบจริง; ผลอัตโนมัติไม่แทนคะแนนมนุษย์
4. หากจะเปิด LINE จริงในอนาคต ต้องตั้ง channel, HTTPS webhook ที่ LINE เข้าถึงได้ และทดสอบ flow/backup โดยเจ้าของบัญชี; ส่วนนี้ไม่ใช่เงื่อนไขของการสาธิต local
5. การเรียก Gemini ผ่าน BuddyShare เป็นจริง ส่วน LINE และ OpenAI สำรองยังเป็น simulator/HTTP doubles

วิธีเปิด/หยุด/สำรองข้อมูลอยู่ใน `docs/local-run.md` ลำดับสาธิตอยู่ใน `docs/demo-runbook.md` คำตอบและภาพจากการทดสอบอัตโนมัติอยู่ใน `reports/task11/`
