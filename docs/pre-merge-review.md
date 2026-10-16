# PostgreSQL migration — pre-merge review

วันที่ 17 ตุลาคม 2026 (Asia/Bangkok) · เป้าหมาย PR เข้า master โดยยังไม่ merge/deploy

## การรวมงาน

เก็บงาน maintenance/cutover เดิมเป็น commit แยกก่อนรวม origin/master ซึ่งมี frontend, business context, RAG และ service modularization เพิ่มมา 34 commits แก้ conflict โดยรักษา PostgreSQL runtime และ durable LINE queue พร้อมย้าย API/RAG modules ของ master เป็น async PostgreSQL ไม่มี SQLite runtime เหลืออยู่

เพิ่ม PostgreSQL 004_rag.sql โดยไม่แก้ checksum migrations 001–003: knowledge_chunks, message_sources และ checkpoint reply_sources/reply_method ใน line_jobs CLI migration rebuild ดัชนีความรู้ก่อน start; indexing ล้มเหลวต้องแก้และรันซ้ำก่อน deploy SQLite import รองรับ snapshot รุ่น 3/4 migrations รักษา message_sources เมื่อมี และ rebuild published chunks โดยไม่ส่ง event เก่าซ้ำ

LINE เก็บหลักฐานก่อน HTTP และสร้าง audit พร้อม assistant message หลังส่งสำเร็จ Recovery ก่อนส่งใช้คำตอบ/หลักฐานเดิมแม้ความรู้ถูกลบ งานส่งไม่แน่นอนคง unknown และไม่ส่งซ้ำ Retention ล้าง checkpoint เก่าพร้อม payload และ reply_text

## การตรวจ

ใช้ Node 24.19.0 และ npm 11.19.0 จาก workspace cache โดยไม่เปลี่ยน npm global ใช้เฉพาะ loopback chatbot_test และ random schema ต่อ fixture ไม่แตะ runtime/staging/production database

ผล local ผ่านครบ: check:toolchain; test:sqlite (3); test:runtime (66); test:import (8); test:postgres (2); test:postgres:schema (3); build โดย DATABASE_URL ว่างและ parent worker=true; test:line:runtime (1); test:production (2); api:check; git diff --check; Docker Compose config รวม 85 tests ไม่มี skip

Production smoke ตรวจ Next CLI จริง, PORT, import/login/tenant/owner/session, restart persistence และ maintenance: health สอง URL ตรวจ DB, malformed business/webhook/simulator ถูกปิด, worker=true ไม่ consume pending job, restart ออกจาก maintenance ใช้งานได้ และไม่มี DATABASE_URL ยังปิด business API ได้พร้อม health 503

Docker Compose รวม app และ PostgreSQL พร้อม persistent volume; app แชร์ network namespace ของ PostgreSQL เพื่อให้ plaintext DB อยู่บน loopback ใช้ Docker smoke job ใน GitHub Actions ตรวจ build/start/health เพราะ Docker daemon ในเครื่องไม่ได้เปิด

ตรวจ static secret patterns ไม่พบ token/private key และไม่มี .env, data หรือ tmp ติดตามใน Git ค่า database/LINE/AI ใน tests เป็น fixtures ส่วนตัวอย่าง local credentials มีไว้พัฒนาเท่านั้น ผล CI ของ commit ล่าสุดและ mergeability ต้องตรวจใน PR ก่อนประกาศพร้อม merge

## งานภายนอกที่ยังต้องยืนยัน

- Render Dashboard auto-deploy จาก master ยังไม่ทราบ แม้ Blueprint ตั้ง off ต้องตรวจให้ชัดก่อน merge; หาก merge กระตุ้น production ต้องผ่าน cutover gate ก่อน
- ผู้ใช้รายงาน staging health และ LINE ตอบได้แล้ว แต่ยังไม่ยืนยันหลักฐาน customer/assistant ใน DB ครบ การตอบซ้ำ และ persistence หลัง restart ทุกกรณี
- Production backup/restore rehearsal, การเลือกเริ่มข้อมูลใหม่หรือ import และการสลับ traffic/LINE เป็นงานผู้ใช้ตาม production-cutover.md
- รายงาน PLAN ระยะ A–H เป็นหลักฐานตามเวลาของแต่ละรอบ ส่วนสถานะรวมล่าสุดใช้เอกสารนี้และผล checks ใน PR
