# รีวิวระยะ F — durable LINE jobs

วันที่: 6 ตุลาคม 2026 (Asia/Bangkok)
Branch: `codex/postgresql-render-migration`

## ผลลัพธ์

Webhook บันทึก LINE event และ text job ใน PostgreSQL transaction เดียวก่อนตอบ 2xx แล้ว Consumer เริ่มจาก Next.js instrumentation ตอน startup ไม่ต้องรอ API request แรก ใช้ claim/lease/heartbeat และ checkpoints เพื่อฟื้นงานหลัง restart โดยไม่เพิ่มข้อความซ้ำ งานที่เริ่มส่งแล้วแต่ยืนยันผลไม่ได้จะเป็น unknown และไม่ retry ส่งอัตโนมัติ

ไม่ได้ตั้งค่า สร้างบริการ หรือ deploy Render ไม่ได้ส่งข้อความไป LINE จริง Tests ใช้ fixture/mock LINE และ PostgreSQL schema สุ่ม chatbot_dev ยังไม่มีข้อมูลธุรกิจ ไม่มี import หรือ seed ลงฐานพัฒนา และ source SQLite/backup ระยะ A ไม่ถูกแก้ งานยังไม่ได้ commit

## หน้าที่แต่ละไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `src/services/lineJobs.js` | producer ภายใน transaction, allowlist payload, validation/deduplication/collision และ deterministic message IDs |
| `src/services/service.js` | ตรวจ raw signature/destination, commit events+jobs ก่อนตอบ, ปลุก consumer หลัง commit และแยก simulator |
| `src/services/worker.js` | claim SKIP LOCKED, leases/heartbeat, customer/reply/send checkpoints, cutoff/retry, recovery และ shutdown |
| `src/services/line.js` | จำกัด reply HTTP timeout, รับ AbortSignal และรายงาน non-2xx ด้วย safe error code โดยไม่อ่าน error body มา log |
| `src/services/simulator.js` | simulator แบบ synchronous สำหรับ development แยกจากคิวจริง ปฏิเสธ production และไม่มีคิวใน memory |
| `src/instrumentation.js` | Node runtime startup hook พร้อม build/runtime guard |
| `src/lib/lineRuntime.js` | consumer singleton, startup retry, wake และ bounded signal shutdown |
| `src/lib/apiRuntime.js` | API ใช้ producer/wake ของ singleton แทนสร้าง consumer จาก request แรก |
| `scripts/build.js` | build wrapper บังคับ worker=false และไม่เปิด manual signal handler ใน child build |
| `scripts/start.js` | เรียก Next CLI ด้วย 0.0.0.0/PORT และ forward signals ให้ runtime ที่จัดการ shutdown |
| `src/services/lineRetention.js`, `scripts/cleanup-line-jobs.js` | เคลียร์ terminal payload/reply tokens ที่เกิน 30 วัน เก็บ deduplication IDs |
| `package.json`, `.env.example` | build/start wrappers, cleanup/runtime test commands และ worker flag |
| `tests/line-jobs.test.js` | integration tests ใหม่ 12 เคส ตรวจ producer/concurrency/delivery/crash/retention |
| `tests/fixtures/line-worker-child.js` | worker child สำหรับทดสอบ kill/crash จริง |
| `tests/line.test.js`, `tests/postgresql-api-regression.test.js` | ปรับ fixture ให้ worker อ่าน channel จาก DB และ wake หลัง durable commit |
| `integration/line-runtime.js`, `integration/fixtures/next-line-runtime.js` | ทดสอบ Next production startup/flag/health/signal lifecycle หลัง build |
| `.github/workflows/ci.yml`, `CONTRIBUTING.md` | เพิ่ม runtime lifecycle check หลัง build |
| `src/lib/contracts.js`, `docs/openapi.json`, `docs/api.md` | อธิบาย processed_count/required event IDs และ 409 collision โดยคง JSON envelope เดิม |
| `README.md`, `docs/line-jobs.md`, `PLAN/phase-f-review.md` | วิธีเปิด consumer, operational SQL, retention และรายงานรีวิว |

ใช้ตาราง/index/constraints line_jobs ที่สร้างใน migration 002 และ deferred checkpoint FKs ใน 003 อยู่แล้ว จึงไม่มี SQL migration ใหม่ และไม่ได้เปลี่ยน checksum ของ migrations เดิม

## กติกาสำคัญ

- ทั้ง batch ของ webhook commit หรือ rollback พร้อมกัน Duplicate ร้านเดิมไม่สร้าง job; global event ID ชนร้านอื่นคืน 409 โดยไม่เปิดเผยข้อมูลร้านเดิม ทุก event ต้องมี ID ที่ต้นทางให้มา ประเภทที่ไม่รองรับเก็บ ignored โดยไม่สร้าง job
- payload เก็บเฉพาะ user ID, text และ reply token ที่ใช้ทำงาน ไม่เก็บ channel secret/access token โหลด access token ใหม่เมื่อจะส่ง
- Consumer 1 ตัวต่อ process, poll 1 วินาที, lease 60 วินาที, heartbeat 15 วินาที Claim ใช้ SKIP LOCKED ทุก renew/checkpoint ตรวจ locked_by และ lease จาก DB clock
- สร้าง/หา conversation ภายใต้ shop/customer lock และสร้าง customer/assistant message IDs จาก shop/event/role การบันทึก customer message กับ checkpoint เป็น atomic transaction
- ไม่ถือ transaction ระหว่าง await generateReply หรือ HTTP ตรวจ bot mode/status ใหม่ก่อนตั้ง sending
- Cutoff 45 วินาทีหลังรับ webhook ถ้าเกินจะเก็บ customer message และจบ failed/REPLY_WINDOW_EXPIRED ไม่มี push ทดแทน
- Retry เฉพาะ transient failure ก่อน send สูงสุด 3 attempts และ backoff 1/3 วินาที ภายใน cutoff
- LINE non-2xx ชัดเจนเป็น failed/LINE_HTTP_REJECTED ส่วน timeout/disconnect และ DB failure หลัง send เป็น unknown/DELIVERY_UNCERTAIN ไม่มี automatic resend
- ตั้ง sending ก่อน HTTP เมื่อ LINE สำเร็จจึงบันทึก assistant+sent+job/event completed ใน transaction หาก DB ใช้งานไม่ได้หลังส่งจะรอ expired lease แล้ว recovery เป็น unknown
- Expired pre-send lease กลับ pending ได้ตาม attempt budget; expired sending lease กลายเป็น unknown Worker เดิมที่เสียสิทธิ์เขียน checkpoints ของ worker ใหม่ไม่ได้
- Imported historical events ไม่มี job จึงไม่ถูก replay line_events คง enum เดิม unknown ใน jobs สะท้อน failed ใน events ต้องใช้ jobs ตรวจแยกผลไม่แน่นอน
- Shutdown หยุด claim และรอ active job ภายใน grace 15 วินาที คืน lease ตาม delivery state ก่อนปิด pool มี process deadline หาก DB/งานไม่จบตามเวลา Recovery หลัง hard exit ยังใช้ lease เดิม
- `db:cleanup:line` เคลียร์ terminal payload/reply_text และ event reply_token หลัง 30 วัน ไม่ลบ IDs/messages ไม่แตะ pending/processing และไม่รันอัตโนมัติ

## ผลทดสอบ

| การตรวจ | ผล |
|---|---|
| `npm test` | 54/54 ผ่าน ไม่มี skipped |
| `npm run test:postgres` | 2 กลุ่มผ่าน |
| `npm run test:postgres:schema` | 3 กลุ่มผ่าน |
| `npm run api:check` | ผ่านหลัง regenerate metadata |
| `npm run build` | ผ่านเมื่อ parent ตั้ง worker=true และ DATABASE_URL ว่าง; wrapper ปิด consumer ให้ build |
| `npm run test:line:runtime` | 1 กลุ่มผ่านกับ Next production server จริง |
| `git diff --check` | ผ่าน |

12 tests ใหม่ครอบคลุม atomic event/job rollback เมื่อ validation หรือ DB ล้มเหลว, concurrent redelivery/cross-shop collision, worker สองตัว, same-customer conversation, heartbeat/revoked lease, imported history, cutoff/bot changes/credential rotation, bounded pre-send retry, non-2xx/disconnect/timeout, DB failure หลังส่ง, shutdown ก่อน/ระหว่างส่ง, retention และ child process kill จริงก่อน/ระหว่าง send รวม DB ตัด backend ก่อน customer insert และ polling ฟื้นหลัง outage โดยไม่มี webhook ใหม่

Next lifecycle test บันทึก job ก่อนเริ่ม server ตรวจฐานโดยไม่เรียก HTTP จน job ถูก consume แล้วจึงตรวจ health เมื่อ worker=false งานยัง pending และ SIGTERM/SIGINT จบด้วย exit 143/130 โดยไม่ค้าง บน Windows ส่ง Node signal event ผ่าน IPC เพราะ OS ไม่มี POSIX signal semantics แบบ Linux CI Linux ใช้ OS signal จริง แต่ยังไม่ได้รัน GitHub Actions remote ต้องตรวจ Linux/Render deploy overlap และ live LINE ใน G อีกครั้ง

Build ยังมี webpack warning เรื่อง top-level await ใน apiConsoleController.js ตามรอบก่อน ไม่มี warning ใหม่จาก queue Logs ทดสอบอยู่ใน `tmp/phase-a/phase-f-*.log` ซึ่งไม่เข้า Git

## ผลรีวิวและงานถัดไป

ไม่พบข้อบกพร่องค้างในขอบเขต F จาก code review และ checks ที่รัน ระบบไม่รับรอง exactly-once delivery ข้าม PostgreSQL/LINE และ unknown ต้องให้ผู้ดูแลตรวจ ห้ามเปลี่ยนให้ pending เพื่อ resend โดยไม่ตรวจผลเดิม Reply cutoff เป็น policy ของแอป ไม่ใช่การรับประกัน token window จาก LINE

ดึง build/start wrapper และ bind 0.0.0.0 บางส่วนจาก G มาทำใน F เพราะจำเป็นต่อการพิสูจน์ startup/shutdown และ build ไม่มี consumer ส่วนการ pin CI tools, Render configuration/staging, live channel และ cutover ยังอยู่ G/H ผู้ใช้ทำส่วน Render เองตามที่กำหนด

วิธีใช้งานและ SQL ตรวจ failed/unknown อยู่ใน [docs/line-jobs.md](../docs/line-jobs.md) ตั้ง `LINE_WORKER_ENABLED=true` เฉพาะ server ที่ตั้งใจให้ consume jobs ก่อนเปิด LINE จริงใน staging
