# จุดพักงานล่าสุด

## 20 ตุลาคม 2026 — AI หลัก/สำรอง และความพร้อมสาธิต

- ผู้ใช้ให้ทำตาม PLAN และ `.agent/skills/myskill` โดยทำงานให้เสร็จเท่าที่ไม่ต้องใช้บริการภายนอก ผู้ใช้ยืนยันว่าไม่มี Render/LINE test channel และไม่มีไฟล์ SQLite ต้นทาง จึงเลือก PostgreSQL ใหม่สำหรับสาธิต ไม่อ้างว่าย้ายข้อมูล SQLite เดิมแล้ว
- เพิ่ม `aiProviders.js` เรียก Gemini GenerateContent และ OpenAI Responses แบบ structured JSON โดยรับคีย์จาก environment, ส่งเฉพาะ prompt/หลักฐานของร้าน, ปิดการเก็บ response ในคำขอ OpenAI และปฏิเสธข้อความที่ไม่เป็น substring ของหลักฐานเดียวกัน
- เพิ่ม `aiGateway.js` ให้ Gemini เป็นหลัก/OpenAI สำรอง จำกัดเวลารวม 8.5 วินาทีและครั้งละ 2 วินาที ลองซ้ำหนึ่งครั้งเฉพาะ transient error โดยเว้น 150 ms พัก provider ที่ล้มสองคำขอเป็นเวลา 30 วินาทีและลอง half-open อีกครั้ง; หากทั้งคู่ล้ม RAG เดิมตอบแบบคัดหลักฐาน/ไม่มีข้อมูล
- คง HTTP generator เดิมเมื่อไม่ได้ตั้งคีย์สองราย เพิ่มสถานะ AI ใน preview และ env/Compose/docs; `test:runtime` รวมชุด `ai-gateway` ใหม่
- ตรวจด้วย Node 24.19.0/npm 11.19.0 และ PostgreSQL 18 แยกจากแอปเดิม: runtime บนโค้ดสุดท้าย 108/108, SQLite 3/3, import 8/8, PostgreSQL 2/2, schema 3/3, LINE lifecycle 1/1, production 2/2, browser 11 ขั้นตอน, evaluation 28/28 + failover 7/7 + handover 7/7, build, api:check, audit 0 vulnerabilities ผ่าน
- สร้างฐาน `chatbot_demo` ในคอนเทนเนอร์ PostgreSQL ทดสอบแยก รัน migrations 001–005 และ seed สองร้านสำเร็จ เปิด Next development ที่ `http://127.0.0.1:3131` เพื่อตรวจ preflight 4 URL, login/preview และ LINE Simulator (ตอบ extractive พร้อมหลักฐาน) ผ่าน; คอนเทนเนอร์นี้ใช้ `--rm` ไม่มี volume ถาวร และ LINE จริงยังปิด
- เพิ่ม `scripts/demo-preflight.js`, `docs/demo-runbook.md` และ `reports/task12/readiness.md` สำหรับตรวจ release/สาธิตและแยกผลจำลองจากผลจริง
- สิ่งที่ยังต้องทำเมื่อมีบริการ: ตั้ง Render/LINE test channel และ secret store, ทดสอบ API จริงทั้งสองรายและ LINE ถึงอุปกรณ์, ให้คนให้คะแนน `human-review.csv`, วัด tokens/ค่าใช้จ่าย/latency จริง, ซ้อม backup/restore และตรวจ staging/cutover ห้ามนับผล fixture เป็น production ผ่าน


## ข้อ 11 — ชุดทดสอบอัตโนมัติ/รายงานเสร็จ และข้อจำกัดที่ต้องตรวจจริง

- ทำต่อบน branch task11-integration-testing จาก task10-human-handover; ข้อ 10 มี commits 89e1ab8 (API) และ 34bbe04 (UI) ส่วนข้อ 11 แยกแก้ RAG 55a3983 และ UI 69822c7 แล้ว หน่วยเครื่องมือ/รายงาน/patch dependencies บันทึกต่อใน commit นี้ ไม่มี push/merge
- อัปเดต Next 16.3.5→16.3.8, sharp 0.35.4→0.35.5, source-map-js 1.2.1→1.2.2 ตาม advisory และ lockfile เพิ่ม Playwright สำหรับ QA เท่านั้น; audit จาก Critical 1/High 2 packages เหลือ 0 ไม่ใช้ audit fix --force และไม่ได้อ้างว่าเคย exploit แอปได้
- npm run test:evaluation ผ่าน 3 tests: gold 28/28 (correctness/relevance/grounded/tenant ทุกมิติ 28), AI boundary/failover 7/7, handover 7/7 เวลา local webhook→worker→DB p50 114.35ms / p95 157.9ms / max 174.04ms ตาม results.json รอบที่เก็บ ไม่ใช่ production SLA
- npm run test:browser ผ่าน 1 test / 11 ขั้นตอนบน Chrome headless production frontend ทั้ง 1440px/390px ไม่มี page error และไม่มี document overflow ตรวจภาพแล้ว; API browser ถูกส่งต่อไป real HTTP/PG service ที่ฉีด LINE test transport ผล production API/CLI แยกตรวจใน smoke
- runtime ล่าสุด 99/99 ผ่าน; schema/PostgreSQL/import/backup/production/LINE lifecycle รวม 19/19 ผ่าน; build Next 16.3.8, api:check, check:toolchain, diff --check ผ่าน
- Docker smoke rebuild รุ่นล่าสุดใน project task10-smoke แยกพอร์ต 3110/55510 สำเร็จ app/PG healthy, HTTP health database ok และ container ยืนยัน next@16.3.8 ใช้เฉพาะ test volume ไม่แตะ runtime เดิม
- หลักฐานอยู่ docs/task11-review.md และ reports/task11/: expected/actual JSON+Markdown, baseline 27/28 ก่อนแก้, before/after audit, browser/network/screenshot และ CSV คะแนนมนุษย์ว่าง 28 แถว ตรวจไฟล์/JSON/จำนวน/ลิงก์ภาพมีจริงแล้ว
- เพิ่ม CI evaluation/browser/audit gates และ artifact ใน reports/ci-task11 แยกจากรายงาน Git เพื่อไม่เอาผลเก่าไปแทนรอบ CI ที่ยังไม่ได้รัน ยังไม่ได้ยืนยัน remote CI เพราะไม่ได้ push
- ค่า LINE/AI ภายนอกรอบ fixtures เป็น 0 เพราะไม่มีการเรียกจริง; billable tokens/ค่า hosting/ค่า production ยังไม่วัด ไม่สร้างตัวเลขแทนสิ่งที่ไม่ทราบ
- งานที่ยังต้องยืนยันด้วยคน/บัญชีที่ได้รับอนุญาตก่อนข้อ 12: คะแนนมนุษย์ใน human-review.csv, LINE bot→human push→Pause/Resume ถึงอุปกรณ์จริง, provider/model/token/ราคาและเวลาเครือข่ายจริง รวมถึงสิทธิ์ Vercel/Render และ remote checks ของ commit ที่จะรวม
- รันซ้ำใช้ TEST_DATABASE_URL แบบ loopback chatbot_test แยกจาก runtime; browser ต้อง build ก่อนและมี Chrome หรือ PLAYWRIGHT_CHANNEL=chromium หลังติดตั้ง browser ที่เข้ากัน ไม่อ่าน credentials หรือ deploy เพื่อทดสอบ

## ข้อ 11 — แก้หน้าจอและตรวจ Chrome

- พบ Chrome flow กรอก Secret เร็วแล้ว GET โหลด LINE config ที่ช้าล้างค่าทิ้ง จนฟอร์มไม่ส่ง PUT และ signed webhook ตอบ 404; สร้าง deferred GET regression ให้ล้มก่อนแก้
- lineSettings ล็อก input/save ระหว่างโหลด ใช้ request version และ shopId ที่จับตอนบันทึก ป้องกันคำตอบเก่า/ร้านเก่าแก้หน้าปัจจุบัน; โหลดล้มเหลวยังคงปิดการกรอกและแนะนำเปิดแท็บใหม่เพื่อลองอีกครั้ง
- แก้ HomeJourney ที่ยังบอกข้อ 9–10 เป็นงานอนาคต ให้มีการ์ดบทสนทนา/รับช่วง/Pause/Resume ผ่าน /app ตามหน้าที่ใช้งานจริง
- DOM integration ผ่าน regression ใหม่และทั้ง runtime 99/99; dashboard-session 13 tests ผ่าน การตรวจ Chrome headless บน production frontend ผ่านครบ 11 ขั้นตอน มีภาพ 1440px/390px ไม่มี document overflow และไม่มี page error (ไม่ใช่ accessibility audit เต็มรูปแบบ)
- Chrome ใช้ HTTP/PostgreSQL test service จริงผ่าน browser API forwarding และแทนเฉพาะ LINE transport ไม่มีการส่งหาลูกค้าจริง เครื่องมือ/ภาพ/รายงานจะบันทึกแยกอีก commit; ยังไม่ push/merge

## ข้อ 11 — แก้การเลือกหลักฐานผิดเรื่องจาก Unicode ภาษาไทย

- เพิ่ม gold fixtures 28 ข้อแล้วพบ 1 เคส: ถามรับโอนธนาคาร แต่ตอบรายละเอียดร้านซึ่งไม่มีธนาคาร เก็บ expected เดิมไว้ ไม่เปลี่ยนเฉลยให้ผ่าน
- probe พบ NFKC แยกสระอำใน “สำหรับ” ทำให้ Intl.Segmenter เกิด token “รับ” ร่วมกับคำถาม แล้วคะแนน cosine ผ่าน threshold
- คืนรูปสระอำเฉพาะ terms() ไม่เปลี่ยน embedding/version หรือบังคับ reindex; เพิ่ม regression ทั้งกรณีไม่มีข้อมูล (ต้องปฏิเสธ) และเพิ่ม policy ธนาคารแล้ว (ต้องตอบถูก)
- RED ก่อนแก้และ GREEN หลังแก้ผ่าน; evaluation ชุดเดิม 28/28 โดย correctness/relevance/grounded/tenant ทุกมิติผ่าน 28/28 รายงานและเครื่องมือจะบันทึกอีกหน่วยงาน
- runtime ล่าสุดทั้งชุด 99/99 ผ่านบน Node 24.19.0 โดยมี dependency patch และ UI fixes ใน working tree ซึ่งจะบันทึกแยกต่อไป ยังไม่ push/merge

## ข้อ 10 — หน้าจอและคู่มือเสร็จ

- เพิ่มรับช่วง/Pause/Resume ในห้องเดิม พร้อมช่องพิมพ์ ส่งไป LINE และผลการส่ง 20 รายการล่าสุด; disable ตามโหมด/สถานะห้อง/ระหว่างส่ง แสดง sent ว่า LINE รับแล้ว ไม่ใช่อ่านแล้ว
- unknown คงร่างและ request ID ปุ่มตรวจสถานะไม่ส่ง LINE ซ้ำ ผลเก็บในฐานและอ่านหลัง remount ได้ สลับห้อง/ร้านไม่พาข้อมูลหรือผลคำขอเก่าไปทับห้องใหม่
- tests/conversation-dashboard.test.js ผ่านทั้ง 5 tests กับ HTTP/PostgreSQL จริง รวม flow รับช่วง→ส่ง→Pause→Resume, XSS, remount, unknown, paging/filter, stale shop response และ visibility
- README/docs/conversations.md อธิบาย API ใหม่ migration ลำดับ deploy ข้อจำกัดการส่ง และกรณี unknown; OpenAPI ตรงกับ runtime
- บันทึกแยก API และ UI ตาม skill; ยังไม่ push/merge ทั้งสองหน่วย การทดสอบ LINE เป็น boundary จำลองและไม่มี browser สำหรับ visual QA ข้อ 10
- ขั้นต่อไปข้อ 11 ตามคำสั่งผู้ใช้: สร้างชุดวัดผลซ้ำได้ เก็บ expected/actual/เวลา/ขอบเขตต้นทุน และรายงานช่องว่างจริง

## ข้อ 10 — API รับช่วงและส่งข้อความ (branch task10-human-handover)

- เพิ่ม API `POST/GET .../conversations/{conversationId}/replies` ส่ง LINE Push ไปยังลูกค้าที่เก็บในห้อง ด้วย token ร้านเดียวกัน ไม่ใช้ API messages เดิมซึ่งบันทึกอย่างเดียว
- เก็บ delivery ใน PostgreSQL พร้อม request UUID กันซ้ำ สถานะ sending/sent/failed/unknown และ author; สร้างข้อความ agent เฉพาะเมื่อ LINE รับคำขอแล้ว ไม่กล่าวอ้างว่าอ่านแล้ว
- จำกัดส่ง 5,000 ตัวอักษร ตรวจสมาชิก owner/agent ห้องเปิด โหมดพัก/มนุษย์ และ LINE config; ไม่ส่งซ้ำเมื่อ timeout/5xx/ผลไม่แน่นอน มี timeout จริง 10s และ recovery sending ค้าง 30s
- Migration 005 เพิ่ม outbox, revision และเวลาเปลี่ยนโหมด; trigger ยกเลิก AI รุ่นเก่าแม้ Pause→Resume และ worker ไม่ย้อนส่งคิวก่อน Resume เปรียบเทียบ timestamp ใน PostgreSQL เพื่อไม่เสีย microseconds
- เปลี่ยนโหมดใช้ row lock เดียวกับจุดเริ่มส่ง หากเริ่มส่งอยู่ตอบ 409 รอจนจบ ไม่ยืนยัน Pause ทั้งที่ยังส่งไม่เสร็จ
- ตรวจ Node 24.19.0/npm 11.19.0: runtime รอบรวม 95 ผ่าน; หลังเพิ่ม regression microsecond ทดสอบ handover ล่าสุด 8/8 ผ่าน รวม timeout จริงและ DB ล้มเหลวหลัง LINE รับแล้ว; API contract tests ผ่านครบ endpoints
- schema/PostgreSQL/SQLite import+backup รวม 16 tests ผ่าน; production smoke+LINE runtime รวม 3 ผ่าน; build ล่าสุด, api:check, check:toolchain และ diff --check ผ่าน
- Docker smoke แบบแยก project task10-smoke ใช้พอร์ต 3110/55510 healthy และ health ตอบ database ok; migration 001–005 ครบ ไม่ใช้ volume/ฐาน runtime เดิม ตัว Docker build เริ่มก่อนปรับการเปรียบเทียบ microsecond ขั้นสุดท้าย ส่วน source build/targeted test ตรวจหลังแก้แล้ว
- LINE ใช้ test transport เท่านั้น ไม่มีข้อความไปหาลูกค้าจริงและไม่มีการ deploy/push/merge; ก่อนใช้จริงหยุด worker รุ่นเก่าทุก instance รัน db:migrate:postgres แล้วเปิดรุ่นใหม่
- หน้าจอข้อ 10 ทำและทดสอบ DOM/HTTP/PostgreSQL แล้ว จะบันทึกแยกอีก commit พร้อมคู่มือ ไม่มี browser เชื่อมต่อสำหรับตรวจภาพ
- ผู้ใช้สั่งให้ต่อข้อ 11 หลังจบข้อ 10: ทดสอบรวม ความถูกต้อง/เกี่ยวข้อง/ไร้หลักฐาน ความเร็ว Handover Failover และต้นทุน พร้อมหลักฐานจริง ไม่แทนข้อมูลทดสอบเป็นผล production

## งานล่าสุด: ปุ่มหลักหน้าแรกหลังเข้าสู่ระบบ

- เปลี่ยนปุ่มกลาง HomeHero เป็น **จัดการร้าน** เมื่อยืนยัน session แล้ว ใช้สีมิ้นต์ #a4f0e4 ไอคอนร้าน ขนาดข้อความ 16px และความสูงอย่างน้อย 56px; ลิงก์ยังไป /app และคงรูปแบบ guest เดิม
- ย้ายการตรวจ session ของหน้า home ไป HomeAccountProvider เพื่อให้เมนูบัญชีและปุ่มหลักอ่านสถานะเดียวกัน ไม่ยิง /users/me แยกคนละชุด; ออกจากระบบแล้วปุ่มกลับเป็นเข้าสู่ระบบทันที กรณี 401 เป็น guest ส่วน 503 คง token/ปุ่มจัดการร้าน
- ทำ regression ให้ล้มก่อนแก้ โดยพบผู้ล็อกอินยังเห็น 'เข้าสู่ระบบ / เริ่มใช้งาน'; หลังแก้ dashboard-session tests ผ่าน 12 รายการ ครอบคลุม guest/หมดอายุ/เครือข่าย/ล็อกเอาต์และกลับหน้าแรก
- ตรวจรวมล่าสุดบน Node 24.19.0/npm 11.19.0: test:runtime ผ่าน 85 รายการ (รวมชุดข้อ 9 บน PostgreSQL), build/api:check/git diff --check ผ่าน และ production smoke หลัง build ใหม่ผ่าน 2 รายการ
- ตรวจ Chrome บน production CLI + PostgreSQL schema ทดสอบแยกที่พอร์ต 3109: login demo กลับหน้า home พบปุ่มจัดการร้านจริง ตรวจ computed background rgb(164,240,228), font 16px, สูง 56px, href /app และกดกลับแดชบอร์ดได้ ปิดแท็บ/เซิร์ฟเวอร์ทดสอบหลังตรวจ ไม่แก้ข้อมูลร้านจริง
- บันทึกแยกจาก commit P1 d9af8bb; งานทั้งหมดอยู่บน task9-chat-page ยังไม่ push/merge PR #7 หรือ deploy Render และไม่ได้ทำ production cutover

## งานล่าสุด: แก้ P1 ของ PR #7 ให้รวมกับ PostgreSQL master ได้

- รวม master e695be7 เข้า branch task9-chat-page แบบ local และแก้ conflict โดยคงระบบ PostgreSQL/durable LINE worker ของ master พร้อมฟีเจอร์ข้อ 9 ไม่ได้ merge PR, push หรือ deploy
- ทำซ้ำอาการบน PostgreSQL 18 จริง: statistics endpoint เดิมตอบ 500 แทน 200 เพราะใช้ SQLite API; แก้เป็น async db.query พร้อม $1 และ countToNumber ให้ count(*)/message_count เป็นจำนวนเต็มตาม HTTP contract ไม่ใช่ int8/string
- รายการห้องยังค้น/กรองก่อนนับและแบ่งหน้า ใช้ strpos กับ bound parameters แทน instr และใช้ created_at,id เป็นลำดับคงที่ตาม master แทน rowid (เวลาเท่ากันเรียง id ไม่ใช่ลำดับ INSERT)
- ย้าย tests/conversation-api.test.js และ tests/conversation-dashboard.test.js ไปใช้ PostgreSQL fixture/migrations จริง แยก random schema ในฐาน chatbot_test บน loopback; เพิ่มเข้า test:runtime ที่ CI ใช้จริง ไม่ทำ SQLite compatibility adapter
- production smoke ตรวจ statistics/list filters/message_count/last_message ด้วย session จริงบน production CLI, การกันข้ามร้าน/401, agent access และยอดคงเดิมหลัง restart
- ตรวจบน Node 24.19.0 + npm 11.19.0: runtime 85 tests ผ่าน, SQLite backup 3, import 8, PostgreSQL 2, schema 3, LINE runtime 1 และ production smoke 2 ผ่าน; build ผ่านขณะ DATABASE_URL ว่างและ parent worker=true, check:toolchain ผ่าน
- ใช้ container ทดสอบเฉพาะ task9-review-postgres ที่พอร์ต 55439 ไม่แตะฐาน runtime หรือทำ production cutover; คำขอปรับปุ่มหน้าแรกหลัง login จะทำต่อเป็นอีกหน่วยงานแยก

## งานล่าสุด: ข้อ 9 หน้าบทสนทนาและสถิติ — implementation เสร็จบน task9-chat-page

- ย้ายงานทั้งหน่วย API และหน้าจอไป branch `task9-chat-page` ตามคำสั่งระหว่างทำงาน ไม่ได้ push/merge หรือเปลี่ยน remote; ตอนตรวจสุดท้าย master/origin/master อยู่ที่ 8c5d987 (แก้ CONTRIBUTING.md) โดยงานข้อ 9 ยังคงแยกใน feature branch
- เพิ่มแท็บ **บทสนทนาและสถิติ** และ URL `/app/shops/{shopId}/conversations` รองรับเข้าโดยตรง/เปิดใหม่/กลับจากหน้าแรก โดยไม่ล้าง session
- อ่านข้อมูลจริงผ่าน API: รายการห้องเรียงอัปเดตล่าสุด ข้อความล่าสุด จำนวนข้อความ สถานะห้อง/บอท ค้นชื่อลูกค้า/รหัสลูกค้า กรอง LINE/เว็บ เปิด/ปิด และโหมดบอท แบ่งห้อง 20 รายการและประวัติ 50 ข้อความต่อหน้า
- เริ่มอ่านที่หน้าข้อความล่าสุด ภายในหน้าเรียงเก่าไปใหม่ แสดงผู้ส่งและเวลาไทย ใช้ textContent เพื่อไม่ตีความข้อความลูกค้าเป็น HTML
- แสดงสถิติทั้งร้าน ไม่ใช่ยอดเฉพาะหน้าที่โหลด รวม role และ channel ชัดเจน; ห้อง human คือโหมดปัจจุบัน ไม่ใช่จำนวนครั้งส่งต่อสะสม และสถิตินับข้อมูลตัวอย่าง/Simulator ที่บันทึกด้วย
- รีเฟรชด้วยปุ่มหรือทุก 15 วินาทีเฉพาะหน้านี้ ยกเลิกคำขอเมื่อสลับร้าน ออกจากหน้า/ระบบ หรือซ่อนแท็บ; คำตอบเก่าไม่ทับร้านใหม่ มีสถานะกำลังโหลด/ไม่มีข้อมูล/ผิดพลาดและลองใหม่ ไม่ล้าง session เพราะ 503 แต่ล้างเมื่อ 401
- คู่มือและนิยามอยู่ใน `docs/conversations.md`; งานนี้เป็นหน้าอ่านประวัติ/สถานะ ยังไม่ทำปุ่มรับช่วง ส่งข้อความ และ Pause/Resume ของข้อ 10

### ผลตรวจข้อ 9

- `npm test` ผ่าน 60 รายการ, `npm run api:check`, `npm run build` และ `git diff --check` ผ่าน
- `tests/conversation-api.test.js` ตรวจสถิติที่รู้ยอดแน่นอน ห้องว่าง ข้ามร้าน 105 ห้อง กรองก่อนแบ่งหน้า ข้อความเวลาเดียวกัน และ signed LINE webhook ที่ประวัติ/ตัวเลขตรงกันและข้อความซ้ำไม่เพิ่มยอด
- `tests/conversation-dashboard.test.js` ใช้ component/controller จริงกับ HTTP API และ SQLite ชั่วคราว ตรวจประวัติ 61 ข้อความ การแบ่งหน้าห้อง/ข้อความ ค้นหา XSS เปิดใหม่ซ้ำ สลับร้านระหว่างรอผล 503/401 และ polling/visibility
- ตรวจด้วย Chrome บน production build ที่พอร์ต 3109 และฐานข้อมูลทดสอบแยก: เข้าสู่ระบบบัญชี demo เปิดหน้าด้วย URL โดยตรง เลือกห้องอ่านประวัติและดูสถิติได้ ตรวจหน้าจอปกติและมือถือ 390px พร้อม screenshot; ไม่พบเนื้อหาล้นแนวนอน คืน viewport เดิมหลังตรวจ และไม่เพิ่มข้อมูลลงฐานข้อมูลร้านจริง
- เปิด Docker Desktop ที่ปิดอยู่ แล้ว `docker compose up -d --build app` ผ่าน คง volume เดิม; `docker compose exec -T app npm test` ผ่าน 60 รายการบน Node.js 24 และ `npm run api:check` ใน Docker ผ่าน
- ตรวจพอร์ต 3000: URL หน้าบทสนทนาตอบ 200 มีแท็บใหม่ build ID ตรงกับคอนเทนเนอร์ OpenAPI มี statistics endpoint, `/api/health` ตอบว่าแอปและฐานข้อมูล ok และคอนเทนเนอร์ healthy
- ข้อจำกัด: webhook test จำลองเฉพาะตัวส่ง LINE ไม่ได้ส่งถึงบัญชี LINE จริง; การสาธิตครบเส้นทางกับ LINE จริงและงาน AI หลัก–สำรอง/รับช่วงตอบยังเป็นงานตรวจรวม/ข้อ 5, 8, 10 ตามแผน ไม่ได้อ้างว่าผ่านจากเทสต์จำลอง

## หน่วยงานก่อนหน้า: API บทสนทนาและสถิติ

- เพิ่ม GET `/api/v1/shops/{shopId}/statistics` นับห้องและข้อความทุก role จากข้อมูลทั้งร้าน ไม่ใช้จำนวนเฉพาะหน้าที่โหลด และไม่ JOIN จนยอดคูณกัน
- `human_conversations` หมายถึงห้องที่อยู่ในโหมด human ปัจจุบัน ไม่ใช่ยอดการส่งต่อสะสม; สถิติเป็นยอดทั้งหมดตั้งแต่เริ่มใช้ร้าน รวม LINE/เว็บ
- รายการห้องค้นชื่อลูกค้า/รหัสลูกค้า และกรอง channel/status/bot_mode ก่อนนับและแบ่งหน้า เรียงห้องที่อัปเดตล่าสุด พร้อมจำนวนข้อความและข้อความล่าสุด
- ข้อความเรียง created_at และ rowid เพื่อคงลำดับรับเมื่อเวลาเท่ากัน; ทุก endpoint ตรวจสมาชิกและ shop_id ตามเดิม
- เขียนเทสต์ให้ล้มก่อนเพิ่ม endpoint/filters แล้วแก้จนผ่าน รวม 105 ห้อง, อักขระ %, ห้องว่าง, ข้อความเวลาเดียวกัน และการแยกร้าน
- `npm test` ผ่าน 56 รายการ; สร้าง OpenAPI ใหม่แล้ว ส่วน UI และการตรวจ Docker จะทำต่อในหน่วยงานถัดไป ยังไม่ถือว่าข้อ 9 เสร็จครบ
## แก้ P1: LINE crash recovery ก่อน reply cutoff — 17 ตุลาคม 2026

- ลด default lease จาก 60 เป็น 15 วินาที และ heartbeat จาก 15 เป็น 3 วินาที คง poll 1 วินาที/cutoff 45 วินาที/HTTP timeout 10 วินาที เพื่อมีเวลากู้ สร้างคำตอบ และส่งหลัง worker ล่มก่อน sending
- เปลี่ยน crash regression ให้ใช้ค่า default จริง รอ heartbeat ก่อน SIGKILL แล้วกู้ผ่าน polling โดยไม่แก้ timestamp หรือบังคับ lease หมดอายุใน DB ตรวจ customer checkpoint เดิม/assistant ไม่ซ้ำและส่งก่อน cutoff; kill ระหว่าง sending ต้อง unknown และไม่ส่งซ้ำ
- ตรวจด้วย Node 24.19.0/npm 11.19.0 และ PostgreSQL 18 บน loopback chatbot_test/schema สุ่ม: test LINE jobs ผ่าน 13/13, natural recovery ส่งหนึ่งครั้งที่อายุงาน 18.5 วินาที; sending recovery เป็น unknown ส่ง 0 ครั้ง; git diff --check ผ่าน
- รวม origin/master ถึง 8c5d987 แล้ว รักษางาน frontend/session/account ใหม่ แก้ CI/CONTRIBUTING/npm lockfile โดยคง PostgreSQL และ Docker checks; ลบ pnpm lockfile ที่กลับมาเพราะโปรเจกต์กำหนด npm และเพิ่ม dashboard-session tests ใน runtime group
- ผล local บนผลรวม: npm ci --include=dev และ check:toolchain ผ่าน; SQLite 3, runtime 78, import 8, PostgreSQL 2, schema 3, LINE lifecycle 1, production smoke 2 รวม 97 tests ผ่าน ไม่มี skip; build ผ่านขณะ DATABASE_URL ว่างและ parent worker=true; api:check, Docker Compose config, secret-pattern scan และ git diff --check ผ่าน
- npm ci รายงาน dependency audit warnings (2 high, 1 critical) ใน dependency set ที่ pin อยู่ ยังไม่ได้ตรวจ advisory หรืออัปเกรดนอกขอบเขตงาน P1 นี้
- CI ของ ddb4f10: รอบ PR 39036314694 ผ่านทั้งหมดรวม Docker; รอบ push 39036312489 ล้มเฉพาะ test heartbeat เดิมที่ lease 250ms (crash regression ค่า default จริงผ่าน ส่งที่ 18.1s) จึงแก้ test heartbeat เป็น lease 5s/heartbeat 0.5s รอเกิน lease แรกและเทียบกับ DB clock เพื่อทน scheduler ของ CI โดยยังตรวจ keepalive/fencing ครบ
- ทดสอบ heartbeat/fencing ที่แก้ผ่านในเครื่อง ขั้นต่อไป push commit test fix และตรวจ CI ของ head ใหม่ ห้าม merge/deploy ในรอบนี้
- Render auto-deploy, backup/restore และ production cutover ยังต้องยืนยันโดยผู้ใช้ตาม docs/production-cutover.md

## งานล่าสุด: แก้ GitHub Actions ที่ล้มเหลวตอนติดตั้งแพ็กเกจ

- อ่าน GitHub Actions run `39019685168` ของ commit `36b3867f8eff475ca1d232cc637491d5045ffcec` พบล้มที่ `pnpm install --frozen-lockfile` ด้วยข้อความ `This project is configured to use npm`
- ทำซ้ำด้วย `npx --yes pnpm@11.19.0 install --frozen-lockfile` แล้วล้มด้วยสาเหตุเดียวกัน ยืนยันว่าไม่ใช่เทสต์แอปหรือ build ล้ม
- แก้ `.github/workflows/ci.yml` ให้ใช้ npm 11.19.0 ตาม packageManager, cache จาก package-lock.json และรัน npm ci / npm run build / npm test / npm run api:check โดยยังคง Node.js 24.19.0
- ตรวจขั้นตอนทั้งหมดใน Docker สภาพแวดล้อมสะอาดบน Linux ด้วย Node.js 24.19.0 + npm 11.19.0: npm ci ผ่าน, build ผ่าน, เทสต์ 54 รายการผ่าน และ OpenAPI contract ผ่าน; ตรวจในเครื่องผ่านเช่นกัน และ git diff --check ผ่าน
- การทดสอบ CI ใช้ image ชั่วคราว `smb-chatbot-ci-check:local` ไม่ได้เปลี่ยนคอนเทนเนอร์แอปพอร์ต 3000

### งานค้างและข้อจำกัดของ CI/Deployment

- ยังไม่ได้ push commit แก้ไข จึงยังไม่อ้างว่า GitHub Actions รอบใหม่ผ่าน; run ของ commit 36b3867 ที่ตรวจยังเป็น failure
- Vercel เป็นอีก check แยกกัน: GitHub commit status และ deployment 7137380766 ระบุเพียง `Deployment was blocked` ไม่มีรายละเอียดสาเหตุ
- หน้ารายละเอียด Vercel/URL deployment ต้องเข้าสู่ระบบเจ้าของโครงการ; ส่งคำถามขอข้อความเหตุผลที่บล็อกไปแล้ว ยังไม่ยืนยันว่าเป็นปัญหาสิทธิ์ผู้เขียน commit หรือสาเหตุอื่น และไม่ได้แก้ author, สิทธิ์สมาชิก หรือปิด check เพื่อหลบปัญหา
- หลังผู้ใช้อนุญาต push ให้ตรวจ Actions ของ SHA ใหม่ และอ่านเหตุผลจาก Vercel ก่อนแก้ปัญหา deployment ต่อ

## งานก่อนหน้า: คืนสีเดิมและใช้ #333 เฉพาะเส้นกรอบ

- ผู้ใช้แก้ความต้องการให้ #333 เป็นเส้นกรอบ ไม่ใช่พื้นหลังกล่อง จึงยกเลิก CSS ธีมเข้มทั้งหมดจากงานก่อนหน้า
- เปลี่ยน class เป็น `outlined-panel` โดยกำหนดเพียง border 1px solid #333 และคงสีเส้นกรอบขณะ hover; ใช้กับกล่องชุดเดิมใน home, ร้านค้า, ข้อมูลธุรกิจ, FAQ/ความรู้/หน้าต่างแก้ไข และการเชื่อมต่อ LINE
- พื้นหลัง สีข้อความ ช่องกรอก placeholder สีสถานะ และ focus กลับมาใช้ utility/style เดิมก่อนงานธีมเข้ม; Kanit SemiBold และพฤติกรรมการเปิดฟอร์ม/เมนูบัญชีไม่เปลี่ยน
- เทียบ source กับ commit ก่อนเพิ่มธีมเข้มแล้ว เหลือเพียงการเพิ่ม class เส้นกรอบและ CSS เส้นกรอบ ไม่มีสีพื้น/ข้อความธีมเข้มหลงเหลือใน src
- `git diff --check` ผ่าน, `docker compose up -d --build app` ผ่าน และเทสต์ใน Docker บน Node.js 24 ผ่าน 54 รายการ (fail 0)
- ตรวจ HTML/CSS จากพอร์ต 3000: กล่องชุดเดิมเป็นพื้นขาวและมีกรอบ #333 ทั้งสี่ด้าน, หัวข้อ/ลิงก์กลับเป็นสีน้ำเงินเดิม, ไม่เหลือสีช่องกรอกเข้ม และ Kanit 600 ยังอยู่; `/health` ตอบ 200 และคอนเทนเนอร์ healthy
- ข้อจำกัดการตรวจ: JSDOM ไม่ประมวลผล Tailwind @layer/custom properties ครบ จึงคลี่ layer และอ่านค่าตัวแปรจาก CSS จริงในการตรวจสี ไม่ใช่ screenshot จากเบราว์เซอร์จริง
- ไม่รวม HomeHero.jsx และ `.agent/` ที่เป็นงานนอกขอบเขตเข้า commit

## งานก่อนหน้า (ถูกแทนที่แล้ว): กล่องพื้นหลัง #333 ตามภาพและหน้าตั้งค่าร้าน

- อ่านภาพที่ผู้ใช้แนบทั้งสองภาพ และใช้ #333 เป็นพื้นหลังกล่องในรายการหน้าของระบบบน home, ร้านของคุณ/ไม่มีร้าน/สร้างร้านใหม่ และการ์ดร้านที่สร้างจาก controller
- ใช้ class `charcoal-panel` ร่วมกันในกล่องข้อมูลธุรกิจ แถบเลือกหน้าตั้งค่า กล่อง FAQ/ความรู้/ตัวอย่างข้อมูล AI รวมถึงหน้าต่างเพิ่ม-แก้ไข/ลบความรู้ และกล่องเชื่อมต่อ LINE
- รวมสีไว้ใน globals.css แบบ scoped: ข้อความสว่าง ช่องกรอก #262626 ขอบและ placeholder ที่มองเห็นชัด พร้อม focus; คงปุ่มหลักสีน้ำเงินและสีป้ายสถานะเดิม ไม่เปลี่ยนพื้นหลังเว็บทั้งหน้า
- คงพื้นที่บทสนทนาและสีบับเบิลของ LINE เพื่อแยกข้อความลูกค้ากับบอท และปรับ hover ของปุ่มให้ไม่กลายเป็นข้อความสว่างบนพื้นอ่อน
- `npm test` ผ่าน 54 รายการ; build ในเครื่องผ่าน และ `git diff --check` ผ่าน
- ตรวจ HTML/CSS ที่ให้บริการจริงด้วย JSDOM: กล่องหลักที่ระบุมี computed background rgb(51,51,51), ข้อความ rgb(245,245,245), ช่องกรอก rgb(38,38,38) และลิงก์บนกล่องเข้มเป็นสีอ่อน
- คำนวณ contrast ของข้อความหลัก/รอง/ลิงก์และ placeholder กับพื้นหลังที่ใช้ ได้อย่างน้อย 7.35:1 (ตรวจเฉพาะคู่สีเหล่านี้ ไม่ใช่ audit ทั้งเว็บ)
- `docker compose up -d --build app` รอบสุดท้ายผ่าน และ `docker compose exec -T app npm test` ผ่าน 54 รายการบน Node.js 24
- ตรวจ computed styles จากพอร์ต 3000 ซ้ำหลังอัปเดตแล้วผ่าน; build ID ของ HTTP ตรงกับคอนเทนเนอร์ล่าสุด, `/health` ตอบ 200 และคอนเทนเนอร์ healthy
- ข้อจำกัด: ตรวจสีด้วย computed styles ใน DOM ไม่ได้ตรวจภาพ screenshot ของเว็บหลังแก้ด้วยเบราว์เซอร์จริง
- ไม่รวมการแก้ HomeHero.jsx และ `.agent/` ที่มีอยู่ก่อนงานนี้เข้า commit

## งานก่อนหน้า: ซ่อนฟอร์มสร้างร้านจนกดปุ่ม

- หน้าแดชบอร์ดเริ่มจากรายการร้านเต็มพื้นที่ โดยซ่อนฟอร์มสร้างร้านไว้ก่อน และเพิ่มปุ่ม “+ สร้างร้านค้าใหม่” เพื่อเปิดฟอร์มด้านข้าง (เรียงด้านล่างบนจอเล็ก)
- คง form เดิมไว้ใน DOM เพื่อไม่ทำให้ controller ที่ผูก submit ตั้งแต่ mount เสีย; เปิดแล้ว focus ช่องชื่อร้าน และมีปุ่มปิดที่คืน focus ให้ปุ่มสร้างร้านโดยเก็บข้อมูลที่กรอกค้างไว้
- เมื่อสร้างสำเร็จ controller reset form ตามเดิม และ onReset ซ่อนแผงอัตโนมัติก่อนเปิดหน้าตั้งค่าร้านใหม่
- ปรับข้อความกรณียังไม่มีร้านให้แนะนำปุ่มสร้างร้านแทนแบบฟอร์มด้านข้าง
- Regression test ก่อนแก้ล้มเหลวเพราะ form แสดงตั้งแต่เข้าหน้า; หลังแก้ทดสอบเปิด/ปิด/เก็บ draft/POST สร้างร้าน/ซ่อนหลังสำเร็จ/กลับหน้ารายการแล้วผ่าน
- `npm test` ผ่าน 54 รายการ; `npm run build` และ `git diff --check` ผ่าน
- `docker compose up -d --build app` ผ่าน และ `docker compose exec -T app npm test` ผ่าน 54 รายการบน Node.js 24
- ตรวจ `/app` พอร์ต 3000 แล้ว build ID ตรงกับคอนเทนเนอร์ใหม่ มีปุ่มเปิดฟอร์มโดย aria-expanded=false และ aside ของฟอร์ม hidden ตั้งแต่ต้น พร้อม link Kanit 600; `/health` ตอบ 200 และคอนเทนเนอร์ healthy
- ข้อจำกัด: ตรวจพฤติกรรมด้วย DOM integration ไม่ใช่ภาพจากเบราว์เซอร์จริง
- พบการแก้ `src/components/home/HomeHero.jsx` ระหว่างทำงานซึ่งไม่ใช่ส่วนของงานนี้ จึงเก็บไว้และไม่รวมใน commit; `.agent/` ยังคงเป็นไฟล์ของผู้ใช้ที่ไม่ได้นำเข้า commit

## งานก่อนหน้า: Kanit SemiBold ทั้งเว็บ

- ปรับ Google Fonts ให้โหลด Kanit น้ำหนัก 600 เท่านั้น และกำหนด font-family/font-weight ของทุก element ใน body ให้เป็น Kanit SemiBold รวมส่วนที่เดิมใช้ utility ตัวหนา/ตัวบาง
- ก่อนเริ่มงานซ่อนฟอร์มสร้างร้าน `npm test` ผ่าน 53 รายการ; `npm run build` และ `git diff --check` ผ่าน
- ตรวจ stylesheet ของ Google Fonts และดาวน์โหลดไฟล์ TTF จริงมาตรวจด้วย Python: OS/2 weight เท่ากับ 600 และมี cmap ของอักษรไทย
- `docker compose up -d --build app` ผ่าน; ตรวจ HTTP พอร์ต 3000 พบ link โหลด Kanit 600 และ CSS รวมที่ใช้กับ body ทุก element เป็น font-weight 600; `/health` ตอบ 200
- ข้อจำกัด: ยังพึ่ง Google Fonts/อินเทอร์เน็ตเหมือนเดิม และยังไม่ได้ตรวจภาพจริงในเบราว์เซอร์
- งานซ่อนฟอร์มสร้างร้านตามคำขอระหว่างทำงานดำเนินการต่อแยกจาก commit ฟอนต์ ดูหัวข้อด้านบน

## งานก่อนหน้า: เมนูบัญชีบนหน้า homepage

- เพิ่ม `HomeAccountMenu.jsx` ในมุมขวาบนของ `HomeHeader`: ผู้ที่เข้าสู่ระบบเห็นอักษรแรกของชื่อในวงกลม พร้อมชื่อบัญชีบนจอกว้าง
- อ่านชื่อและอีเมลจาก `/users/me` ด้วย session เดิม ไม่ใส่ข้อมูลส่วนตัวลงใน HTML ที่สร้างแบบ static
- Dropdown แสดงชื่อ/อีเมล และมี “จัดการร้าน” ไป `/app` กับ “ออกจากระบบ” ซึ่งเรียก POST `/auth/logout` และล้าง session ในเครื่องโดยอยู่หน้า home ต่อ
- ปิดเมนูด้วยคลิกด้านนอก, Escape (คืน focus ให้ปุ่ม), หรือย้าย focus ออก; พื้นที่กดอย่างน้อย 48px และจำกัดความกว้าง dropdown ตามหน้าจอ
- ผู้เยี่ยมชมหรือ session หมดอายุเห็นปุ่มเดิม; การโหลดบัญชีผิดพลาดชั่วคราวไม่ลบ token และแสดงข้อความใน dropdown; logout ในเครื่องยังทำได้เมื่อ server ติดต่อไม่ได้ เช่นเดียวกับแดชบอร์ด

### ผลตรวจเมนูบัญชี

- เริ่มจาก test ที่ล้มเหลวเพราะ homepage ไม่มีปุ่มบัญชี ก่อนเพิ่ม component จริง
- `npm test` ผ่าน 53 รายการ รวมการกลับจากแดชบอร์ดมาดูชื่อบัญชีบน home, ลิงก์จัดการร้าน, POST logout พร้อม token, guest/401, Escape/คลิกด้านนอก และปัญหาเครือข่าย
- `npm run build` และ `git diff --check` ผ่าน
- `docker compose up -d --build app` ผ่าน และ `docker compose exec -T app npm test` ผ่าน 53 รายการบน Node.js 24
- ตรวจ `/home` พอร์ต 3000 แล้ว build ID ตรงกับคอนเทนเนอร์ใหม่ และ JavaScript ที่ให้บริการมีปุ่มบัญชี/ออกจากระบบใหม่; `/health` ตอบ 200 และคอนเทนเนอร์ healthy
- ข้อจำกัด: ทดสอบพฤติกรรมด้วย DOM integration ของ component จริง ไม่ได้ตรวจภาพด้วยเบราว์เซอร์จริง

## งานก่อนหน้า: กลับหน้าแรกแล้วไม่หลุดบัญชี

- สาเหตุ: dynamic import ของ controller ถูก cache แต่หน้า `/app` ถูกสร้าง DOM ชุดใหม่หลังกลับจาก `/home`; controller เดิมจึงไม่เริ่มใหม่และยังอ้าง DOM ที่ถอดไปแล้ว ไม่ใช่ homepage ลบ token
- เปลี่ยน controller เป็น `initializeDashboard()` เรียกทุกครั้งที่ mount อ่าน session เดิมจาก `sessionStorage` และค้น element ชุดปัจจุบัน
- ส่ง element และตัวผูก listener ให้โมดูลย่อยตามอายุหน้า; cleanup ถอน route/DOM listeners ยกเลิกคำขอ และหยุดการแจ้งเตือน โดยไม่ลบ session
- ป้องกันคำตอบล่าช้าจากหน้าที่ปิดไปแล้วกระทบ session ปัจจุบัน; ล้าง session เมื่อ API ตอบ 401 หรือผู้ใช้กดออกจากระบบ ไม่ล้างเพราะข้อผิดพลาดเครือข่าย/503
- เพิ่ม DOM integration tests ใน `tests/dashboard-session.test.js` ใช้ component/controller จริงภายใต้ React StrictMode และจำลอง API ด้วยข้อมูลทดสอบ ไม่มีการใช้บัญชีจริง
- เพิ่ม esbuild/jsdom เป็น dev dependencies และอัปเดต lockfile ของ npm กับ pnpm

### ผลตรวจงานล่าสุด

- ก่อนแก้ regression test ล้มเหลวตรงการกลับจาก homepage แล้วแสดงฟอร์ม login; หลังแก้ผ่าน
- `npm test` ผ่าน 47 รายการ รวม 5 regression tests: กลับจาก homepage ซ้ำ 3 รอบและเปิดตั้งค่าร้านได้, login หลังกลับหน้า, logout ทำงานครั้งเดียว, session หมดอายุ, server 503 และคำตอบ 401 ล่าช้า (บาง test ครอบคลุมหลายสถานการณ์)
- `npm run build`, `npm run api:check` และ `git diff --check` ผ่าน
- ตรวจ pnpm lockfile แบบ frozen ผ่าน โดยใช้ pnpm 10 พร้อมปิด package-manager-strict สำหรับการตรวจครั้งนี้ เพราะ package.json ระบุ npm
- `docker compose up -d --build app` ผ่าน โดยคง volume ข้อมูลเดิม; `docker compose exec -T app npm test` ผ่าน 47 รายการบน Node.js 24 ของ image
- ตรวจพอร์ต 3000: build ID ของ HTTP ตรงกับคอนเทนเนอร์ใหม่, `/home` และ `/health` ตอบ 200, คอนเทนเนอร์ healthy

### ข้อจำกัดและขั้นตอนถัดไป

- ตรวจการเปลี่ยนหน้าด้วย DOM integration ไม่ใช่เบราว์เซอร์จริง; ยังไม่ได้ตรวจด้วยภาพหน้าจอ
- ไม่ได้เปลี่ยนอายุ session หรือเปลี่ยน sessionStorage เป็นการจำบัญชีข้ามการปิดแท็บ
- `.agent/` เป็นไฟล์ที่ผู้ใช้เพิ่มไว้ก่อนงานนี้ จึงไม่นำเข้า commit ของการแก้บั๊ก

## งานแก้ปุ่มสมัครสมาชิก

- ย้ายการสลับฟอร์มเข้าสู่ระบบ/สมัครสมาชิกไปอยู่ใน React เพื่อรับคลิกได้โดยไม่ต้องรอ controller โหลด และเพิ่มพื้นที่กดสูงอย่างน้อย 48px
- ตรวจด้วย DOM harness: คลิกทันที สลับกลับ เปิดหน้าใหม่ และลิงก์ `?mode=register` ผ่าน
- `npm test` ผ่าน 42 รายการ; `npm run build` และ `git diff --check` ผ่าน
- อัปเดต Docker แล้ว ตรวจ HTTP ที่พอร์ต 3000 พบสถานะฟอร์มและ CSS ใหม่ และ `/health` ตอบ 200
- ยังไม่ได้ตรวจภาพหน้าจอด้วยเบราว์เซอร์ เพราะเครื่องมือไม่พบเบราว์เซอร์ที่เชื่อมต่อ

## งานที่ทำ

- เชื่อมข้อมูลธุรกิจที่บันทึกใน `shops` เข้ากับการค้นหลักฐานตอบ Chatbot โดยแยกเป็นชื่อร้าน ประเภท สินค้า/บริการ รูปแบบบริการ เวลาเปิด และรายละเอียดเพิ่มเติม
- ใช้เฉพาะ FAQ/คลังความรู้สถานะ `published` ของร้านเดียวกัน; FAQ ที่ตรงคำถามมาก่อนข้อมูลอื่น
- สร้าง prompt ที่แยกคำสั่งระบบออกจากคำถาม บุคลิก ข้อมูลร้าน และหลักฐาน พร้อมตรวจว่าคำตอบจากบริการ AI ภายนอกตรงกับหลักฐานก่อนส่ง
- เพิ่มโทนคำตอบจากบุคลิกที่เลือก และบันทึกรหัสกับข้อความหลักฐานในประวัติแชต
- เพิ่ม API และกล่อง “ดูข้อมูลที่ Chatbot ใช้ตอบ” ในแท็บ FAQ/คลังความรู้ เพื่อดูข้อมูลร้าน หลักฐานที่เลือก และ prompt จากคำถามตัวอย่าง
- อัปเดต OpenAPI, README และเอกสารสถาปัตยกรรม

## ผลการตรวจ

- `npm test` ผ่าน 42 รายการ รวมการแยกร้าน ฉบับร่าง การเปลี่ยนข้อมูลร้าน การตรวจคำตอบ AI และ API ดูตัวอย่าง
- `npm run build` ผ่าน
- `npm run api:check` ผ่าน
- `git diff --check` ผ่าน
- `docker compose up --build -d` ผ่าน; คอนเทนเนอร์สถานะ healthy และ `/api/health` ตอบว่าแอปกับฐานข้อมูลปกติ
- ทดลอง `prepareAnswerContext` กับร้านจริงใน Docker: คำถาม “ร้านเปิดกี่โมง” เลือกหลักฐาน “เวลาเปิดให้บริการ” จากข้อมูลธุรกิจ และได้ prompt 2 ข้อความ
- ตรวจ API ดูตัวอย่างบน Docker โดยไม่ส่ง token ได้ HTTP 401 ตามที่กำหนด

## ข้อมูลจริงใน Docker ณ จุดตรวจ

- มีร้าน 1 ร้านชื่อ `poonsawat cacare` มีรายละเอียดธุรกิจ เวลาเปิด และบุคลิกที่บันทึกไว้
- ยังไม่มีรายการ FAQ/คลังความรู้ในฐานข้อมูลนี้
- ยังไม่ได้ตั้ง `RAG_GENERATOR_URL` จึงตอบแบบคัดข้อความจากหลักฐานในเครื่อง และมี prompt พร้อมสำหรับบริการ AI ภายนอกเมื่อเชื่อมต่อ

## ข้อจำกัดและขั้นตอนถัดไป

- ตรวจการทำงานด้วย test และ build แล้ว แต่ยังไม่ได้ตรวจภาพหน้าจอด้วยเบราว์เซอร์อัตโนมัติ เพราะการเข้าถึง origin ถูกปฏิเสธในการทำงานก่อนหน้า
- ไฟล์ที่ไม่ได้ติดตามใน `docs/` มีอยู่ก่อนงานนี้ ไม่ได้นำเข้า commit
