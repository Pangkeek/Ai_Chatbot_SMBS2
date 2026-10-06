# ตั้งค่าและตรวจ Render staging — ผู้ใช้ดำเนินการ

ส่วนโค้ด/CI ของ G และ production rehearsal ในเครื่องพร้อมแล้ว เอกสารนี้คือขั้นตอนบน Render ที่ผู้ใช้ต้องทำเอง ยังไม่มีบริการถูกสร้าง ไม่มี deploy หรือ live LINE test และยังไม่ผ่าน gate staging บน Render จริง

## 1. เตรียม release และฐาน staging

1. ใช้ commit ที่ผ่าน CI บน GitHub จาก repository นี้ การเปลี่ยนแปลง G ในรอบนี้ยังไม่ได้ commit/push จึงยังเลือก release ที่รวม G บน Render ไม่ได้
2. สร้าง PostgreSQL staging แยกจาก production เลือก PostgreSQL 18 และ Singapore
3. ตั้งชื่อแยก เช่น `smb-chatbot-staging-db`; ห้ามชี้ staging ไป production DB
4. เลือก compute/storage ตามงบที่ต้องการก่อนกดสร้าง ตัวอย่าง render.yaml เป็น paid Web Service + paid PostgreSQL จึงมีค่าใช้จ่ายเมื่อผู้ใช้สร้าง/apply จริง
5. เก็บ Internal URL สำหรับ Web Service และ External URL สำหรับ migration/import จากเครื่อง จำกัด external access เป็น IP ของผู้ดูแล `/32` เฉพาะช่วงที่ต้องใช้

ถ้าทดลอง Free ต้องรับข้อจำกัด web sleep และ DB หมดอายุ 30 วัน รวมถึงไม่มี paid pre-deploy command ให้ migrate จากเครื่องแยกก่อนเริ่ม deploy ห้ามย้าย migration เข้า build เป็นทางลัด Free ไม่ใช่หลักฐานว่า production LINE พร้อม

อ้างอิง [PostgreSQL connections](https://render.com/docs/postgresql-creating-connecting), [Free limitations](https://render.com/docs/free) และ [Render Deploys](https://render.com/docs/deploys)

## 2. ซ้อม import ก่อนเปิดแอป staging

ทำบน DB staging ที่ว่างและยังไม่มี Web Service รับ business writes ใช้ snapshot สำหรับทดสอบที่ตั้งใจเลือกพร้อม manifest ข้างไฟล์ ไม่รัน seed บน production mode และไม่ใช้ DB ซ้อมที่มีข้อมูลแล้วเป็น target final import

ตัวอย่าง PowerShell ใน terminal ใหม่ (ไม่แก้ .env ที่ใช้ dev):

```powershell
$env:DATABASE_URL = Read-Host 'Render staging External Database URL' -MaskInput
# This project configures TLS via DB_SSL_MODE; URL query parameters are not accepted.
$env:DATABASE_URL = ($env:DATABASE_URL -split '\?', 2)[0]
$env:DB_SSL_MODE = 'verify-full'
$env:DB_SCHEMA = 'public'
$env:SQLITE_SOURCE_PATH = './data/backups/sqlite-<id>/snapshot.sqlite'
npm exec --yes --package=npm@11.19.0 -- npm run db:migrate
npm exec --yes --package=npm@11.19.0 -- npm run db:import:sqlite -- --dry-run
npm exec --yes --package=npm@11.19.0 -- npm run db:import:sqlite
npm exec --yes --package=npm@11.19.0 -- npm run db:verify:import
```

แต่ละคำสั่งต้อง exit 0 ก่อนทำคำสั่งถัดไป เก็บ manifests ไว้เป็นหลักฐาน ถ้าพบ commit-uncertain ให้ verify target เดิมก่อน ไม่ reset/import ทับ ปิด terminal หลังใช้ URL เก็บ secrets/snapshot/reports ในพื้นที่จำกัดสิทธิ์ ไม่ใส่ Git หรือส่ง URL ที่มี password มาในแชต

หากเริ่ม staging โดยไม่มีข้อมูลเดิม ข้าม import ได้ แต่ต้อง migrate และสร้างบัญชีทดสอบผ่าน API/UI เอง ไม่เติม demo accounts ด้วย production seed

## 3. สร้าง Web Service

เลือก Node Web Service เพราะมี Next.js/API server เชื่อม repository และเลือก branch/commit ที่ผ่าน CI ตั้ง region Singapore ให้ตรง DB เริ่ม 1 instance และปิด auto deploy ช่วงแรก

| Setting | ค่า |
|---|---|
| NODE_VERSION | `24.19.0` |
| Build Command | ใช้ buildCommand ใน render.yaml: check toolchain → npm ci → build ด้วย npm 11.19.0 |
| Pre-deploy Command (paid) | `npm exec --yes --package=npm@11.19.0 -- npm run db:migrate` |
| Start Command | `npm exec --yes --package=npm@11.19.0 -- npm start` |
| Health Check Path | `/api/health` |
| Auto Deploy | Off ระหว่างซ้อม; เปิด Checks Pass หลังตรวจครบ |
| Instance count | 1 |

Copy Build Command แบบบรรทัดเดียว:

```text
npm exec --yes --package=npm@11.19.0 -- npm run check:toolchain && npm exec --yes --package=npm@11.19.0 -- npm ci && npm exec --yes --package=npm@11.19.0 -- npm run build
```

| Environment | ค่า |
|---|---|
| NODE_ENV | production |
| DATABASE_URL | **Internal URL ของ staging DB** ไม่มี query parameters |
| DB_SSL_MODE | require (Render internal TLS ใช้ self-signed certificate) |
| DB_SCHEMA | public |
| DB_POOL_MAX | 5 |
| DB_CONNECT_TIMEOUT_MS | 5000 |
| DB_QUERY_TIMEOUT_MS | 10000 |
| LINE_WORKER_ENABLED | false จนกว่าจะพร้อมทดสอบ channel แยก |

ปล่อย PORT ให้ Render กำหนด Start launcher เรียก Next CLI ใน process เดียว ใช้ 0.0.0.0 และอ่าน PORT จาก environment ไม่คัดลอก PORT=3000 จาก .env.example ไม่มี SQLite path/TEST_DATABASE_URL ใน Render runtime และไม่ตั้ง DATABASE_URL/credentials เป็น NEXT_PUBLIC_* Build wrapper บังคับ consumer=false เฉพาะ child build; pre-deploy ไม่เริ่ม consumer

อ้างอิง [Node version](https://render.com/docs/node-version), [Web Service port](https://render.com/docs/web-services), [Internal/external TLS](https://render.com/docs/postgresql-creating-connecting)

## 4. render.yaml เป็นทางเลือก

render.yaml ที่ root เป็น reference production configuration: paid resources ใน Singapore, PostgreSQL 18, migration pre-deploy, internal DB reference, health, pinned toolchain, auto-deploy off และ worker=false ไม่มี credentials literal และปิด external DB access ด้วย ipAllowList ว่าง

ถ้าจะใช้ Blueprint สำหรับ staging ต้องเปลี่ยนชื่อ Web/DB และ fromDatabase.name ให้ตรงกับชื่อ staging ก่อน ไม่ผูกกับ resource production หากสร้างผ่าน Dashboard แล้วให้ใช้ไฟล์อ้างอิงแทน apply ซ้ำ เพราะ Blueprint อาจสร้างบริการใหม่หรือแก้บริการที่ชื่อชนกัน ผู้ใช้เลือกและตรวจรายการ resource/ค่าใช้จ่ายก่อน apply เอง

ชื่อ plan IDs ในไฟล์ตรวจจากเอกสารปัจจุบัน: Web `0.5c-512mb`, DB `0.1c-256mb`, disk 1 GB ปิด storage autoscaling เป็นจุดเริ่มต้นของตัวอย่าง ปรับตามงบและ RAM/CPU ที่วัดได้ Schema validation ไม่รับประกัน capacity หรือค่าใช้จ่ายจริงของ account ต้องดู Dashboard ขณะสร้าง

อ้างอิง [Blueprint reference/schema](https://render.com/docs/blueprint-spec)

## 5. เกณฑ์ตรวจ staging จริง

- [ ] บันทึก commit, service URL และชื่อ staging DB ที่ใช้ โดยไม่มี credentials
- [ ] Build, migration และ health ผ่าน; logs ไม่มี DB URL/password/bearer token/LINE credentials/payload ทั้งก้อน
- [ ] `/`, `/app`, `/docs`, `/api/health`, `/health`, `/openapi.json` เปิดได้
- [ ] Imported users login ด้วย password เดิม หรือบัญชีทดสอบที่สร้างใหม่ใช้งานได้
- [ ] สร้างร้าน/ความรู้/บทสนทนา/ข้อความ เปลี่ยน bot mode ได้ตามสิทธิ์
- [ ] สองร้านแยกข้อมูล; agent แก้ข้อมูล owner-only ไม่ได้; expired token คืน 401
- [ ] Production simulator คืน 404 และ production seed ถูกปฏิเสธ
- [ ] Restart และ manual redeploy commit เดิมแล้วข้อมูล/session ที่ยังไม่หมดอายุยังอยู่
- [ ] Counts/checksums ของ import ตรงทุกตาราง ก่อนเริ่มสร้างข้อมูลใหม่บน staging

หลังเริ่ม business writes checksum จะต่างจาก snapshot ตามปกติ จึงต้องเก็บผล verify ก่อนเริ่ม smoke writes ไม่ reset ฐานเพื่อให้ checksum ตรง

## 6. LINE staging ใช้ channel ทดสอบแยก

1. ตั้ง channel ทดสอบบนร้าน staging ห้ามใช้ channel จริงของลูกค้า Snapshot ที่มี channel จริงต้องเปลี่ยน configuration ให้เป็น channel ทดสอบก่อนเปิด consumer
2. ตั้ง `LINE_WORKER_ENABLED=true` ใน Web Service แล้ว deploy/restart เฉพาะ staging
3. ใน LINE Console ตั้ง `https://<staging-host>/api/v1/shops/<SHOP_ID>/line/webhook`, เปิด Use webhook และ Verify
4. ส่งข้อความจากบัญชีทดสอบ ตรวจ event/job/customer message และ assistant เมื่อยืนยัน LINE send สำเร็จ
5. ทดสอบ duplicate redelivery และ restart/deploy overlap งานเก่าไม่สร้าง customer/assistant ซ้ำ ตรวจ failed/unknown ตาม [คู่มือคิว](line-jobs.md)
6. ไม่ replay imported historical events หรือ unknown jobs อัตโนมัติ

LINE Console และ Render ขั้นตอนทั้งหมดในเอกสารนี้ผู้ใช้ดำเนินการเอง เมื่อรายการ staging ผ่านจึงเดินไป final cutover ใน H ห้ามนับ production smoke ในเครื่องว่า Render/live LINE ผ่านแล้ว
