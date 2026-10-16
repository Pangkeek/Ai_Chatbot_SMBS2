# Production cutover และ rollback — ผู้ใช้ดำเนินการ

โค้ด H เตรียม maintenance gate เท่านั้น การย้าย production, Render, LINE Console และ backup/restore จริงเป็นงานผู้ใช้ ยังไม่ถือว่าผ่าน production cutover

## Maintenance

ตั้ง environment แล้ว restart/deploy ทุก instance:

```dotenv
APP_MAINTENANCE_MODE=true
LINE_WORKER_ENABLED=false
```

`/api/health` และ `/health` ยังตรวจฐานข้อมูลตามเดิม API อื่นตอบ 503 `MAINTENANCE_MODE` พร้อม Retry-After 60 ก่อน authentication/body/database initialization รวม webhook และ simulator หน้าจอเว็บยังเปิดได้ แต่เรียก business API ไม่ได้ ไม่มี administrator bypass; ตรวจข้อมูลแบบ read-only ด้วยเครื่องมือ DB ของผู้ดูแล

Flag มีผลกับ process ที่เริ่มใหม่ ไม่หยุด request/job ที่เริ่มก่อนหน้า รอ deploy/restart และ shutdown ของ process เก่าจบทุกตัวก่อน backup ห้ามถือว่าเปลี่ยน environment แล้ว writers เก่าหยุดทันที อย่าเปิด consumer สองระบบที่ใช้ channel จริงเดียวกัน

## Gate ก่อนใช้งานจริง

- บันทึก release commit, ชื่อ DB/service, URL และผู้รับผิดชอบ โดยไม่บันทึก credentials
- staging ต้องผ่าน login/CRUD/tenant permissions, persistence หลัง restart และ LINE จริง มีข้อความลูกค้า/assistant ใน DB ครบ ไม่มี duplicate reply การตอบใน LINE อย่างเดียวไม่ยืนยันการทดสอบทั้งหมด
- ใช้ channel ทดสอบแยกจนผ่าน gate เตรียมข้อมูลร้านจริงและ credentials ต่อร้าน
- เลือก production compute/backup ตามงบ Free staging ไม่เท่ากับ production ที่มี backup พร้อม ต้องตรวจข้อจำกัดปัจจุบันใน Render ก่อนใช้งานจริง
- กำหนด maintenance window จากเวลาซ้อม import+verify+smoke และเผื่ออีกหนึ่งรอบ เตรียม restore ซ้อมบน DB แยก

## ทางเลือก A: เริ่มด้วยข้อมูลใหม่

ไม่ต้อง import SQLite หากฐาน Render มีบัญชี/ร้าน/ข้อความทดสอบแล้ว อย่าใช้เป็น target import ที่ต้องว่าง เลือกว่าจะเก็บข้อมูลนั้นสำหรับ staging หรือสร้างฐาน production ใหม่แยก ผู้ใช้ต้องตัดสินใจก่อนเปลี่ยน traffic

1. เตรียม schema ด้วย `db:migrate` และข้อมูลจริงที่ต้องใช้ผ่านระบบ
2. ตรวจ health/login/สิทธิ์ และการบันทึกข้อมูล หลัง restart
3. ตั้ง `APP_MAINTENANCE_MODE=false` และ `LINE_WORKER_ENABLED=true` เมื่อพร้อมรับ LINE
4. ตั้ง webhook ของ channel จริงต่อร้านจาก URL ที่เว็บแสดง เปิด Use webhook และ Verify ส่งข้อความทดสอบ ตรวจ DB ว่ามี customer/assistant ครบ
5. บันทึกเวลาเริ่ม write จริง ตรวจ health/logs/failed/unknown jobs ใน 24–48 ชั่วโมงแรก

## ทางเลือก B: ย้าย SQLite เดิม

1. ปิด writers เดิมทุกตัว รวม localhost/tunnel/webhook/worker รอ drain แล้วหยุด process SQLite ทั้งหมด baseline SQLite เดิมไม่มี H gate นี้ ต้องหยุด writers จริง
2. ใช้ `db:backup:sqlite` สร้าง final snapshot ตรวจ manifest/integrity/FK เก็บ source เดิมไว้อย่างจำกัดสิทธิ์
3. เตรียม PostgreSQL production ที่ว่างและ migrations ครบ เปิดแอปใหม่แบบ maintenance และ consumer=false
4. ใน terminal ใหม่ตั้ง External DATABASE_URL แบบไม่เปิดเผย, DB_SSL_MODE=verify-full, DB_SCHEMA=public และ SQLITE_SOURCE_PATH เป็น snapshot ที่มี manifest ข้างไฟล์ ตาม docs/render-staging.md
5. รัน `db:import:sqlite -- --dry-run` → `db:import:sqlite` → `db:verify:import` แต่ละขั้นต้อง exit 0 เก็บรายงาน counts/hash ก่อน business writes ถ้า commit-uncertain ให้ verify target เดิมก่อน ไม่ import/reset ทับ
6. หยุดถ้า import/verify/health/permissions ผิด แก้ก่อนเปิด write ไม่ seed และไม่ replay imported events
7. ปิด maintenance เปิด worker แล้วทดสอบ login/ร้าน/ความรู้/ข้อความ สลับ LINE webhook ต่อร้านและ traffic เมื่อพร้อม
8. บันทึกเวลา write แรก PostgreSQL คงระบบ SQLite เดิมปิดการเขียน เพื่อไม่ให้มีสองฐานรับข้อมูลจริง

## Rollback

ก่อน PostgreSQL รับ write ใหม่: คง maintenance/consumer=false เก็บ target/manifest/logs คืน traffic และ webhook ไป baseline SQLite ได้เมื่อยืนยันว่าไม่มีข้อมูลใหม่บน PostgreSQL และระบบเดิมพร้อม

หลังมี write ใหม่: อย่ากลับ SQLite snapshot ทันที ข้อมูลใหม่และสถานะส่ง LINE จะหาย ให้ rollback code ไป release ที่รองรับ PostgreSQL/schema ปัจจุบัน หรือทำ corrective migration หากข้อมูลผิด ให้หยุด writers, backup PostgreSQL และ restore ไป DB แยกเพื่อเทียบก่อนเปลี่ยน target การกลับ SQLite ต้องทำ reverse export/reconciliation เป็นงานแยก

งาน LINE สถานะ unknown ห้าม resend อัตโนมัติ ตรวจตาม docs/line-jobs.md Migration ใหม่ต้องรองรับ release ก่อนหน้าระหว่าง deploy overlap

## หลักฐานปิด H

บันทึก commit/time/DB/service, ผล staging และ restart, manifests (ถ้า import), ผล live LINE/customer+assistant, backup/restore rehearsal และจุด rollback ก่อน/หลัง write จริง ตัดสินผ่าน H เมื่อผู้ใช้ทำ operations ครบ โค้ด/tests ในเครื่องไม่ใช่หลักฐาน production cutover
