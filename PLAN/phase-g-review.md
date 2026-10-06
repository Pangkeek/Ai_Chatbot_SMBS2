# รีวิวระยะ G — CI และการเตรียม Render staging

วันที่: 6 ตุลาคม 2026 (Asia/Bangkok)  
Branch: `codex/postgresql-render-migration`

## ผลลัพธ์และสถานะ gate

ส่วนโค้ด/CI/configuration ของ G พร้อมแล้ว ใช้ Node 24.19.0 และ npm 11.19.0 ที่ทดสอบจริงจาก package-lock มี render.yaml ที่ตรวจด้วย schema ทางการของ Render และ production rehearsal ผ่านในเครื่อง ทั้ง import/password เดิม, API/tenant/owner/session behavior, PORT และ restart persistence

**ยังไม่ผ่าน gate Render staging จริง** เพราะตามขอบเขตที่ผู้ใช้กำหนด ผู้ใช้สร้าง/ตั้งค่า/deploy Render และ LINE Console เอง ยังไม่ได้สร้างบริการที่มีค่าใช้จ่าย, apply Blueprint, deploy, ส่ง live LINE หรือรัน GitHub Actions remote การเปลี่ยนแปลง G ในรอบนี้ยังไม่ได้ commit/push (เริ่มจาก baseline commit 5c0bd40)

## หน้าที่แต่ละไฟล์ที่เปลี่ยนใน G

| ไฟล์ | หน้าที่ |
|---|---|
| `.github/workflows/ci.yml` | pin npm 11.19.0, ตรวจ toolchain, แยก test groups, ทดสอบ build ไม่มี DB แม้ parent worker=true, รัน Next lifecycle/production smoke และ cancel CI run เก่าของ ref เดียวกัน |
| `package.json` | เพิ่ม check:toolchain, test:sqlite, test:runtime, test:import และ test:production; npm test เดิมยังรวม tests ทั้งหมด |
| `scripts/check-toolchain.js` | ตรวจ Node ให้ตรง .nvmrc และ npm ให้ตรง packageManager โดยอ่าน npm user agent ที่ npm ส่งให้ script |
| `scripts/start.js` | เรียก installed Next CLI ใน process เดียวที่ 0.0.0.0/PORT เพื่อให้ signals ถึง instrumentation โดยตรง ไม่มี intermediate child ที่ exit ก่อน drain |
| `render.yaml` | reference production Blueprint: paid Web+DB ใน Singapore, PostgreSQL 18, internal DB reference, pre-deploy migration, health, pinned tools, worker=false และ external DB access ปิด |
| `integration/production-smoke.js` | import SQLite fixture เข้า random PostgreSQL schema แล้วตรวจ production API ผ่าน Next CLI จริง พร้อม restart และ secret-free logs |
| `integration/fixtures/production-server.js` | launcher สำหรับ lifecycle test ของ start script จริง; Windows ส่ง Node signal event ผ่าน IPC |
| `docs/render-staging.md` | ขั้นตอน Dashboard/Blueprint, import, environment, smoke test และ LINE test channel ที่ผู้ใช้ทำเอง |
| `README.md`, `CONTRIBUTING.md` | สถานะ G, pinned toolchain/test grouping, release และลิงก์คู่มือ staging |
| `PLAN/phase-g-review.md` | รายงานหลักฐานและงานที่ยังต้องทำบน Render |

ไม่เพิ่ม runtime dependencies ไม่แก้ schema/migrations เดิม Build wrapper และ durable queue ที่ทำใน F ยังใช้ต่อ

## CI และ toolchain

CI ใช้ GitHub Ubuntu, Node 24.19.0, ติดตั้ง npm 11.19.0 ก่อน npm ci และ PostgreSQL 18 service container Tests ใช้ loopback chatbot_test และ schema สุ่ม ไม่มี production URL ไม่มี shared reset

แยกกลุ่ม tests ครบทุกไฟล์ปัจจุบัน:

- test:sqlite: 3 tests ของ backup และ SQLite baseline
- test:runtime: 44 tests ของ API/PostgreSQL/LINE/UI logic
- test:import: 7 tests ของ snapshot transfer

รวม 54 tests เท่ากับ npm test เดิม เมื่อเพิ่ม test file ต้องใส่ใน script กลุ่มที่เกี่ยวข้องเพื่อให้ CI ไม่ตกหล่น

เครื่องนี้ npm default ยังเป็น 11.17.0 ไม่ได้เปลี่ยน global installation ดาวน์โหลด npm 11.19.0 ไป workspace cache แล้วใช้ npm CLI รุ่นนั้นรัน npm ci และทุก check ในรอบ G Node จริงเป็น 24.19.0 check:toolchain ผ่าน Cache/validators/schema ที่ดาวน์โหลดเป็น tooling ชั่วคราวใต้ tmp ที่ไม่เข้า Git

## Render configuration

render.yaml ใช้ plan IDs จากเอกสารปัจจุบัน: Web 0.5c-512mb, PostgreSQL 0.1c-256mb และ disk 1 GB เป็นตัวอย่าง paid ไม่ได้สมัครแพ็กเกจหรือรับรอง capacity ให้ผู้ใช้ ชื่อ production resource เป็น reference; staging ต้องมีชื่อและ DB แยก

Build ใช้ pinned npm exec → check toolchain → npm ci → npm run build Pre-deploy migrate ผ่านคำสั่งแยก แล้วจึง npm start ที่อ่าน PORT จาก Render ไม่ใช้ PORT ใน .env เพื่อ bind server Internal database reference ไม่ใส่ literal password/URL ใน YAML และ DB_SSL_MODE=require ตาม internal TLS ส่วนเครื่องนำเข้าใช้ External URL กับ verify-full และตัด query parameters ออกจาก URL ตาม databaseConfig ของโปรเจกต์

autoDeployTrigger=off, numInstances=1, LINE_WORKER_ENABLED=false จนพร้อมทดสอบ channel แยก ipAllowList=[] ปิด external DB โดย default ผู้ใช้เปิดเฉพาะ IP ที่ต้องใช้ก่อน external import และปิดกลับตามขั้นตอน ไม่มี persistent disk/SQLite runtime, TEST_DATABASE_URL หรือ public secret variables บน Web Service

ตรวจ YAML กับ JSON schema draft 2020-12 ที่ดาวน์โหลดจาก Render ด้วย Ajv โดยไม่ส่งไฟล์/credentials ไป API และไม่ apply Blueprint Schema validation ยืนยัน structure/types/plan IDs; ยังไม่ยืนยัน account resources, billing, region availability หรือ deployment จริง

อ้างอิง [Blueprint/schema](https://render.com/docs/blueprint-spec), [Node version](https://render.com/docs/node-version), [PostgreSQL connections/TLS](https://render.com/docs/postgresql-creating-connecting) และ [pre-deploy](https://render.com/docs/deploys)

## ผลทดสอบในเครื่อง

| การตรวจด้วย npm 11.19.0 | ผล |
|---|---|
| npm ci จาก lockfile | ผ่าน ติดตั้ง 54 packages |
| check:toolchain | Node 24.19.0/npm 11.19.0 ผ่าน |
| test:sqlite | 3/3 ผ่าน |
| test:runtime | 44/44 ผ่าน |
| test:import | 7/7 ผ่าน |
| test:postgres | 2 กลุ่มผ่าน |
| test:postgres:schema | 3 กลุ่มผ่าน |
| build | ผ่านเมื่อ DATABASE_URL ว่าง และ parent LINE_WORKER_ENABLED=true |
| test:line:runtime | 1 กลุ่มผ่าน |
| test:production | 1 กลุ่มผ่าน |
| api:check | ผ่าน |
| Render official schema / CI YAML parse | ผ่าน |
| git diff --check | ผ่าน |

Production smoke ใช้ SQLite source ที่สร้างใน temporary directory ของ test และ backup API แล้ว dry-run/import/verify เข้า random test schema ก่อนเปิด Next server ตรวจ source SHA ไม่เปลี่ยน ไม่มี production seed ไม่มี HTTP ส่งออกไป LINE

ตรวจ `/`, `/app`, `/docs`, `/api/health`, `/health`, `/openapi.json` เป็น 200, anonymous เป็น 401, imported account login ด้วยรหัสผ่าน fixture เดิม, register/create shop, CRUD knowledge, conversation/messages, bot active/human/closed guards, ข้ามร้าน 404, agent owner-only 403, expired session 401 และ production simulator 404 ก่อน malformed body โดยไม่มี event write

Restart ด้วย production start launcher จริง แล้วตรวจ shop/knowledge/messages และ session เดิมยังใช้ได้ ทดสอบ PORT ที่กำหนดจาก environment และ signal shutdown exit 143 App logs ไม่พบ fixture password, DB URL หรือ bearer tokens บน Windows ใช้ Node signal event ผ่าน IPC ส่วน CI Linux ใช้ SIGTERM/SIGINT จาก OS จริง ยังไม่ได้รัน CI remote

ช่วงเริ่ม G พบ PostgreSQL cluster ท้องถิ่นหยุด จึงเปิด cluster เดิมและทดสอบใหม่จนผ่าน ไม่ reset ข้อมูล chatbot_dev หลังจบ users/shops/memberships/sessions/knowledge/conversations/messages/line_channels/line_events/line_jobs เป็น 0 ทั้งหมด Backup ระยะ A SHA ยังเป็น 0bfe8af7442f6bcc18da3b09c2edf11930f181e48442fa37564a006088ecfe57

Build ยังมี warning top-level await ใน apiConsoleController.js ตามรอบก่อน HTTP smoke ไม่ใช่การคลิก UI จริงใน browser จึงยังต้องตรวจหน้า UI และ live LINE บน staging Logs อยู่ใน tmp/phase-a/phase-g-*.log ที่ไม่เข้า Git

## งานที่ผู้ใช้ต้องทำเองก่อนปิด gate G

ใช้ [คู่มือ Render staging](../docs/render-staging.md): เลือก release commit ที่ผ่าน CI, สร้าง staging DB/Web Service, ซ้อม import ก่อนเปิด business writes, ตั้ง env/internal URL/TLS/health/pre-deploy, ตรวจ restart/manual redeploy และทดสอบ LINE ด้วย channel แยก รวมตรวจ logs/failed/unknown

ไม่ apply render.yaml ซ้ำกับบริการที่สร้างด้วย Dashboard โดยไม่ตรวจ resource names/รายการเปลี่ยนแปลง คู่มือมีขั้นตอน Free alternative โดยรัน migration แยกก่อน deploy แต่ Free ไม่เหมาะใช้เป็น production LINE gate

ไม่พบข้อบกพร่องค้างในส่วนโค้ด G จาก review/checks ที่รัน หลังผู้ใช้ยืนยัน staging จริงผ่าน จึงเดินไป H final snapshot/cutover ส่วน maintenance mode/final production traffic และ rollback decision ยังเป็นงาน H
