# รีวิวระยะ A — SQLite baseline และ backup

วันที่ตรวจ: 6 ตุลาคม 2026 (Asia/Bangkok)

ระยะ A เสร็จสำหรับฐานข้อมูล local ที่ configuration ของ checkout นี้เลือกใช้ พร้อมเริ่มระยะ B ได้ ยังไม่ได้ย้าย runtime ไป PostgreSQL หรือสร้างบริการ Render

## Baseline และผลตรวจ

- Branch: `codex/postgresql-render-migration`
- Baseline SQLite commit: `9b673b1202cc01bec4ba53de8c550404eafd5041` (master ก่อนเริ่มงาน)
- ก่อนเริ่มมีไฟล์แผน migration ที่ยังไม่ tracked; ไม่แก้เนื้อหาแผนเดิม
- Node `24.19.0`; npm ที่ติดตั้ง `11.17.0` ต่างจาก packageManager `11.19.0` — ควรจัดให้ตรงในระยะ B/G
- อ่าน Next.js CLI, self-hosting และ instrumentation guides จาก package ที่ติดตั้งแล้ว
- ก่อนแก้: `npm test` ผ่าน 23/23, `npm run api:check` ผ่าน, `npm run build` ผ่าน
- หลังเพิ่มเครื่องมือ: `npm test` ผ่าน 25/25 ไม่มี skipped, `git diff --check` ผ่าน
- Log อยู่ใน `tmp/phase-a/` ซึ่งไม่เข้า Git

## Source และ backup

`DATABASE_PATH` เมื่อโหลด `.env` ด้วยวิธีเดียวกับ scripts ชี้ `./data/chatbot.sqlite` ตรงกับ default ใน `src/lib/db.js`; พบเฉพาะ `.env` และ `.env.example` ไม่มีไฟล์ environment override ของ Next ใน checkout นี้

ข้อมูลมีผู้ใช้/ร้านนอก demo จัดเป็น **ข้อมูลที่ต้องเก็บทั้งหมด** ไม่ถือเป็น demo-only และไม่ลบหรือ seed ทับ ไม่สามารถยืนยันว่า process ที่เปิดอยู่มี environment override ต่างจาก checkout นี้หรือไม่: การอ่าน process inventory ถูกระบบปฏิเสธ จึงไม่อ้างว่านี่คือ production source หรือหยุด writers ครบแล้ว ต้องตรวจอีกครั้งก่อน cutover

- สำรองเวลา 05:14:41 น. วันที่ 6 ตุลาคม 2026 (เวลาใน manifest เป็น UTC)
- Source main file: 106,496 bytes; พบ WAL 786,952 bytes ตอนตรวจครั้งแรก
- Snapshot: `data/backups/sqlite-DagiB8/snapshot.sqlite` ขนาด 233,472 bytes
- Manifest: `data/backups/sqlite-DagiB8/manifest.json`
- SHA-256: `0bfe8af7442f6bcc18da3b09c2edf11930f181e48442fa37564a006088ecfe57`
- `PRAGMA integrity_check`: `ok`; foreign-key violations: 0; email ซ้ำแบบ case-insensitive: 0; timestamp ที่ไม่ตรง ISO UTC: 0
- Migration 001–003 ครบ และ checksum ตรง repository ทุกไฟล์; ค่า checksum/เวลารันแต่ละ migration อยู่ใน manifest
- LINE events: completed 5, received/processing/failed/ignored 0

| ตาราง | แถว |
|---|---:|
| users | 3 |
| shops | 4 |
| shop_memberships | 4 |
| sessions | 1 |
| knowledge_entries | 6 |
| conversations | 3 |
| messages | 14 |
| line_channels | 2 |
| line_events | 5 |

ตัวอย่างสองร้านจาก snapshot (ใช้ลำดับแทน ID เพื่อไม่เผยข้อมูลร้าน): ร้านตัวอย่าง 1 มีสมาชิก 1 และ LINE channel 1 ยังไม่มีบทสนทนา; ร้านตัวอย่าง 2 มีสมาชิก 1, LINE channel 1, บทสนทนา 1, customer messages 5, assistant messages 5 และ completed events 5 การตรวจนี้เป็นการอ่านสถานะข้อมูล ไม่ได้ส่งข้อความ LINE จริงหรืออ้างว่าข้อความถูกส่งถึงผู้รับแล้ว

## การเปลี่ยนแปลงและวิธีใช้

เพิ่ม `scripts/backup-sqlite.js`, คำสั่งใน package.json และ regression tests:

```powershell
npm run db:backup:sqlite
```

คำสั่งโหลด `.env`, ใช้ `DATABASE_PATH` หรือ default เดิม เปิด source แบบ read-only โดยตรง ไม่ import database initializer ที่รัน migrations และไม่สร้าง source ว่างเมื่อระบุ path ผิด ใช้ SQLite backup API ที่รวมข้อมูล committed ใน WAL แทนการคัดลอก main file

แต่ละรอบสร้าง directory ใหม่ใน `data/backups/`, เปิด snapshot แบบ read-only เพื่อตรวจสอบ และเขียน SHA-256/manifest จาก snapshot เดียวกัน หาก verification ไม่ผ่านจะ exit nonzero พร้อมเก็บหลักฐาน ไม่รายงานว่าสำเร็จ ไม่แก้หรือลบ source

Manifest เก็บ counts, ช่วงเวลา, migration metadata และจำนวนต่อสถานะ ไม่เก็บ email, password/token hash, LINE credentials, reply token หรือเนื้อหาข้อความ แต่ **snapshot มีข้อมูลเดิมทั้งหมดและ secrets** จึงต้องเก็บในพื้นที่จำกัดสิทธิ์ `data/` ถูก ignore อยู่แล้ว; รอบนี้ไม่ได้เพิ่มไฟล์ backup เข้า Git การอยู่ใน Git ignore ไม่ใช่การเข้ารหัสหรือ backup นอกเครื่อง

หาก source เก่ากว่า 003 เครื่องมือรายงาน `missingMigrations` โดยไม่แก้ source; การผ่าน integrity ไม่เท่ากับพร้อม import ต้อง migrate สำเนาทำงานและตรวจใหม่ตามแผนก่อนระยะ E

## ผลรีวิว

ไม่พบข้อบกพร่องที่ขวางการใช้เครื่องมือกับ source ที่ตรวจครั้งนี้ ทดสอบว่า snapshot มีข้อมูลที่ยังอยู่ใน WAL, source main/WAL ไม่เปลี่ยนจากการ backup ใน fixture ที่ไม่มี concurrent writer, สำรองซ้ำไม่ทับไฟล์เดิม, checksum ตรง, manifest ไม่เผยค่าข้อมูล, checksum migration ผิดถูกปฏิเสธ และ missing source ไม่สร้าง DB ว่าง

ขอบเขตที่ยังต้องทำภายหลัง: ยืนยัน production source และ writers, หยุด writers ก่อน final snapshot, สำรองนอกเครื่อง/กำหนด retention และซ้อม import PostgreSQL กับ verify ในระยะ E รายงานนี้รับรอง local rehearsal snapshot ไม่ใช่ final cutover backup

SQLite backup API อ้างอิง: https://nodejs.org/api/sqlite.html#sqlitebackupsourceDb-path-options
