# ระยะ H — review ส่วนโค้ด

เพิ่ม APP_MAINTENANCE_MODE=true เพื่อปฏิเสธ business API ทุก method ด้วย HTTP 503 ก่อน DB/auth/body และคง health ที่ตรวจฐานข้อมูลได้ Worker ไม่เริ่มเมื่อ maintenance แม้ LINE_WORKER_ENABLED=true

| ไฟล์ | หน้าที่ |
|---|---|
| src/lib/maintenance.js | shared gate, safe response, Retry-After |
| src/lib/apiRuntime.js | gate ก่อน lazy DB initialization ของ Next API |
| src/lib/app.js | gate ของ HTTP handler โดยตรง |
| src/lib/lineRuntime.js | กัน consumer เริ่มใน maintenance |
| .env.example | flag default false |
| tests/maintenance.test.js | HTTP rejection ไม่มี DB side effects, health ผ่าน, worker ไม่ initialize |
| package.json | รวม maintenance tests ใน CI runtime group |
| docs/production-cutover.md | runbook เริ่มใหม่/import, maintenance, rollback และหลักฐานปิด H |

Tests maintenance 2 ผ่าน, production build ผ่าน และ git diff --check ผ่าน Build ยังมี warning top-level await เดิมของ apiConsoleController ไม่มี schema migration ใหม่ Flag ต้อง deploy/restart ทุก process และรอ writers เก่าจบก่อน snapshot ไม่มี live-toggle/drain ของ process ที่ยังรันอยู่

ผู้ใช้รายงาน staging health/การทดสอบผ่าน และ LINE ตอบจริงแล้ว ยังไม่ได้ตรวจหลักฐาน DB customer+assistant, production backup/restore และ final cutover ห้ามนับ H operations ว่าเสร็จ Render/LINE Console ผู้ใช้ทำเอง
