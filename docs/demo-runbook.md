# คู่มือสาธิตบนเครื่อง

สถานะ 20 ตุลาคม 2026: ผู้ใช้เลือกรัน local เท่านั้น ฐาน PostgreSQL เริ่มใหม่เพราะไม่มีไฟล์ SQLite ต้นทาง ดูคำสั่งเปิด/หยุดและสำรองข้อมูลใน [local-run.md](local-run.md)

## เตรียมก่อนสาธิต

1. เปิด Docker Desktop แล้วรัน `& ./scripts/local-start.ps1 -SeedDemo` ใน PowerShell ของโครงการ
2. เปิด `http://127.0.0.1:3131` และตรวจ `npm run demo:preflight -- http://127.0.0.1:3131` ให้ทั้ง 4 URL ตอบ 200
3. ใช้ข้อมูลสมมติของร้านกาแฟและร้านดอกไม้เท่านั้น อย่าใส่ข้อมูลลูกค้าจริงในฐานสาธิต
4. เปิด `LINE_WORKER_ENABLED=false` ไว้ใน `.env` เมื่อยังไม่มี LINE channel จริง

## ลำดับสาธิต

1. สมัครบัญชีใหม่หรือเข้าสู่ระบบด้วย `flower@example.test` / `DemoPass!2026` แล้วดูว่าบัญชีเห็นเฉพาะร้านของตน
2. เปิด **ตั้งค่าธุรกิจ** เปลี่ยนรายละเอียดสินค้า เวลาเปิด และบุคลิกบอท แล้วบันทึก
3. เปิด **FAQ/ข้อมูลความรู้** เพิ่มรายการ `published` และ `draft` ถามเรื่องที่เผยแพร่แล้วและเรื่องที่ยังเป็นร่างเพื่อแสดงการคัดเลือกหลักฐาน
4. เปิด **LINE Simulator** ถาม “ช่อกุหลาบราคาเท่าไหร่” ดูคำตอบ `extractive` พร้อมแหล่งอ้างอิง แล้วถามเรื่องที่ไม่มีข้อมูลเพื่อดูการปฏิเสธอย่างปลอดภัย
5. เปิด **บทสนทนาและสถิติ** ดูข้อความที่ Simulator บันทึก ห้องสนทนา และการแยกข้อมูลร้าน
6. สาธิตรับช่วง, Pause และ Resume ด้วยชุดทดสอบ handover อัตโนมัติ การส่งข้อความแอดมินไป LINE จริงต้องมี channel และผู้รับจริง จึงไม่ควรกดส่งในห้องจำลองแล้วอ้างว่าส่งถึงอุปกรณ์
7. สาธิต Gemini หลัก/OpenAI สำรองด้วย `npm run test:evaluation` และ `npm run test:runtime` ซึ่งใช้ HTTP doubles ขณะนี้ BuddyShare key ที่อ่านจากภาพยังได้รับ HTTP 401 จากบริการจริง จึงต้องตรวจคีย์ที่คัดลอกจากต้นทางใน `.env` ก่อนอ้างว่าต่อ AI จริงสำเร็จ

## คำสั่งตรวจ

```powershell
npm run test:runtime
npm run test:postgres
npm run test:postgres:schema
npm run test:evaluation
npm run api:check
npm run build
npm run demo:preflight -- http://127.0.0.1:3131
```

ใช้ Node 24.19.0 และ npm 11.19.0 ตาม [local-run.md](local-run.md) ผลล่าสุดและข้อจำกัดอยู่ใน [รายงานความพร้อม](../reports/task12/readiness.md) แบบประเมินคน `reports/task11/human-review.csv` ยังว่าง ผล fixture ไม่ใช่ผล LINE หรือ AI ภายนอกจริง
