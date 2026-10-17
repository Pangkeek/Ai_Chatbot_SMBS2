# รีวิวระยะ E — SQLite snapshot → PostgreSQL

วันที่: 6 ตุลาคม 2026 (Asia/Bangkok)

## ผลลัพธ์และขอบเขต

ทำเครื่องมือ dry-run, import และ verify ครบแล้ว ซ้อมนำเข้า snapshot ระยะ A ใน schema ทดสอบแยก และตรวจ counts/checksums ตรงกันทั้ง 9 ตาราง จากนั้นลบเฉพาะ schema ทดสอบตาม lifecycle ของ fixture ไม่ได้นำเข้าข้อมูลลง chatbot_dev หรือ production และไม่ได้ตั้งค่าหรือ deploy Render ผู้ใช้ดำเนินการส่วน Render เอง

## หน้าที่ของไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `scripts/sqlite/transfer.js` | ตรวจ snapshot/target, นำเข้าทีละ batch ใน transaction เดียว, ตรวจ checksum/ความสัมพันธ์ และเขียน manifest |
| `scripts/import-sqlite.js` | CLI สำหรับ import หรือ `--dry-run`; ปฏิเสธ flags อื่น รวม `--force` |
| `scripts/verify-import.js` | CLI ตรวจข้อมูลที่นำเข้าแล้วด้วย transaction แบบ read-only |
| `scripts/sqlite/report.js` | พิมพ์ผลย่อที่ไม่มี credentials หรือข้อมูลแถว |
| `tests/sqlite-import.test.js` | integration tests 7 เคสบน PostgreSQL จริงและ SQLite snapshot ที่แยกจากข้อมูลเดิม |
| `package.json` | เพิ่ม `db:import:sqlite` และ `db:verify:import` |
| `.env.example` | อธิบาย source path, batch size และ timeout สำหรับ import |
| `README.md` | วิธีใช้คำสั่งและการรับมือผล commit ที่ไม่แน่นอน |
| `PLAN/phase-e-review.md` | รายงานผลและข้อจำกัดระยะ E |

## การตรวจและการรักษาข้อมูล

- รับเฉพาะไฟล์ snapshot ที่มี backup manifest ถูกต้องและ SHA-256 ตรงกัน เปิด SQLite แบบ read-only ปฏิเสธ live database และ WAL ที่ยังมีข้อมูล ตรวจ source hash อีกครั้งก่อน commit
- ตรวจ SQLite migrations 001–003, schema, integrity, FK, owner membership, ISO UTC, NUL และ email collision ด้วย PostgreSQL `lower(email)`
- target ต้องมี migrations/checksums ตรงกับ repository และทั้ง 9 ตารางธุรกิจรวม line_jobs ต้องว่างก่อน import ไม่มี force, reset หรือ upsert
- ใช้ migration advisory lock และ table locks ป้องกัน import/writers พร้อมกัน ตรวจความว่างใหม่หลังได้ lock
- INSERT ระบุ columns และ parameters ชัดเจน เก็บ IDs, password/session hashes และ LINE credentials เดิม ไม่คัดลอก SQLite migration ledger ไป PostgreSQL
- ค่าเริ่มต้น batch 200 แถว ปรับได้ 1–1000 และแยก import query timeout 60 วินาทีจาก runtime
- เรียง primary keys และ canonical columns เพื่อเทียบ SHA-256 ทุกตาราง normalize timestamps เป็น ISO UTC ตรวจความสัมพันธ์และตัวอย่าง 2 ร้าน
- LINE events เก่าเป็นประวัติเท่านั้น รายงาน received/processing ที่ค้าง ไม่สร้าง jobs หรือส่ง reply เก่า
- Manifest เก็บ source hash, counts/checksums, migrations, target hostname/database/schema, เวลารันและผลตรวจ โดยไม่มี password, token หรือเนื้อหาข้อมูล Errors ใช้ key fingerprint แทน key ที่อาจเป็น session token hash

ถ้าขาดการเชื่อมต่อก่อน commit transaction จะ rollback แต่ถ้าขาดระหว่าง COMMIT จะรายงาน `commit-uncertain`; หาก commit สำเร็จแต่บันทึกผลไม่ได้จะเป็น `committed-report-failed` หรือเหลือ receipt `verified-before-commit` ต้องใช้ verify ตรวจฐานก่อนตัดสินใจนำเข้าใหม่ ห้ามถือว่าข้อผิดพลาดแปลว่าฐานว่างเสมอ

## ผลซ้อม snapshot ระยะ A

Source: `data/backups/sqlite-DagiB8/snapshot.sqlite`

SHA-256: `0bfe8af7442f6bcc18da3b09c2edf11930f181e48442fa37564a006088ecfe57`

| ตาราง | จำนวน source/target |
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

Dry-run, import และ verify ผ่านทั้งหมด Checksum ทุกตารางตรงกันและ line_jobs เป็น 0 Source ไม่เปลี่ยน

Receipts อยู่ใน `data/import-reports/sqlite-transfer-CpzOzi/manifest.json` (dry-run), `sqlite-transfer-1NOW6j/manifest.json` (import), `sqlite-transfer-qvxJJI/manifest.json` (verify) ใต้ directory เดียวกัน Schema ซ้อมถูก cleanup แล้ว ส่วน CLI dry-run บน chatbot_dev ที่ว่างผ่านโดยไม่มี writes: `data/import-reports/sqlite-transfer-jooZdz/manifest.json` ทั้ง snapshots และ reports อยู่ใน data ที่ไม่เข้า Git

## ผลทดสอบ

- `npm test`: 42/42 ผ่าน ไม่มี skipped รวม import tests 7 เคส
- `npm run test:postgres`: 2 กลุ่มผ่าน
- `npm run test:postgres:schema`: 3 กลุ่มผ่าน
- `npm run api:check` และ `git diff --check`: ผ่าน
- `npm run build`: ผ่าน มี webpack warning เรื่อง top-level await ใน `apiConsoleController.js` ซึ่งอยู่นอกส่วน import
- CLI `--force`: ปฏิเสธด้วย exit code 1 ตามที่กำหนด

Import tests ตรวจ rollback หลังเขียนหลายตาราง, server ตัด connection, concurrent imports ที่สำเร็จเพียงครั้งเดียว, source/checksum/migrations ผิด, NUL, target ไม่ว่าง, same-count content tampering, Unicode/ข้อความยาว/null, password login/session/credentials ที่คงเดิม และ receipt ไม่เผย secrets ใช้ fixture credentials สำหรับการทดสอบ login; snapshot จริงยืนยันการรักษาค่าด้วย checksum ไม่ได้ทดลอง login บัญชีจริง

เมื่อกลับมาทำงานต่อพบคลัสเตอร์ท้องถิ่นหยุดและมี stale PID จึงเปิดคลัสเตอร์เดิมและรันทดสอบซ้ำจนผ่าน ข้อมูลเดิมไม่ได้ reset

## งานถัดไป

ไม่พบข้อบกพร่องค้างในขอบเขต E จากการตรวจและ tests ที่รัน งานยังไม่ได้ commit การนำเข้าจริงบน Render เป็นขั้นตอนของผู้ใช้ตาม README ส่วน durable LINE producer/checkpoints/leases/recovery อยู่ระยะ F และยังต้องทำก่อนเปิดใช้งาน production LINE
