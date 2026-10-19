# ปรับแผนเป็นสาธิตบนเครื่อง — 20 ตุลาคม 2026

ผู้ใช้ยืนยันว่าไม่ deploy ไป Render เป้าหมายข้อ 12 จึงเปลี่ยนจาก URL สาธารณะเป็น `http://127.0.0.1:3131` บนเครื่องนี้ ขั้น deploy/cutover ในแผนเดิมเป็นเอกสารอ้างอิงเท่านั้น ไม่ใช่งานค้างของเป้าหมายปัจจุบัน ไม่มีไฟล์ SQLite ต้นทาง จึงเริ่มฐาน PostgreSQL ใหม่แทนการอ้างว่านำเข้าข้อมูลเก่าแล้ว

| ข้อในแผนหลัก | สถานะสำหรับการสาธิต local |
|---|---|
| 1–4 โครงสร้าง บัญชี แยกร้าน ตั้งค่าธุรกิจ | โค้ดและหน้าจอพร้อม ตรวจด้วย HTTP/PostgreSQL และ browser tests |
| 5 LINE | Webhook, worker, queue และการเก็บข้อความมีโค้ด/การทดสอบจำลอง; LINE channel และการส่งถึงอุปกรณ์จริงยังไม่มี |
| 6–7 FAQ ความรู้ และ RAG | พร้อมในหน้าเว็บ/API, index PostgreSQL, คำตอบพร้อมหลักฐานและการปฏิเสธเมื่อไม่มีข้อมูล |
| 8 AI หลัก/สำรอง | Gemini/OpenAI, timeout/retry/failover มีโค้ดและ HTTP fixture ผ่าน; ยังไม่มี API key สำหรับทดสอบบริการจริง |
| 9–10 บทสนทนา สถิติ รับช่วง Pause/Resume | พร้อมในโค้ด/API/หน้าจอและผ่านชุดทดสอบ; push ถึง LINE จริงยังไม่ตรวจ |
| 11 ทดสอบรวม | runtime 108/108, PostgreSQL 2/2, schema 3/3 และชุด evaluation/browser ที่บันทึกใน `reports/task12/readiness.md` ผ่าน; คะแนนคนยังว่าง |
| 12 นำขึ้นระบบ รายงาน สาธิต | เปลี่ยนเป็น local: Docker volume ถาวร, migration, seed, restart persistence, backup/restore rehearsal, preflight, คู่มือและลำดับ Demo พร้อม; ไม่ทำ Render |

เปิดระบบตาม [คู่มือ local](../docs/local-run.md) และสาธิตตาม [runbook](../docs/demo-runbook.md) หากต้องการพิสูจน์ LINE/AI จริงในอนาคต เจ้าของบัญชีต้องตั้งค่า channel, HTTPS webhook และ API keys แล้วตรวจผลแยกจาก fixture
