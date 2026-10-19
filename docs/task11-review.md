# ข้อ 11 — ทดสอบรวม วัดผล และแก้บั๊ก

## สรุปขอบเขต

ทดสอบโค้ดต่อจากข้อ 10 บน PostgreSQL 18 แบบ random schema ในฐาน `chatbot_test` แยกจากฐาน runtime ใช้ข้อมูลสมมติสองร้านจาก `seedDemo` และบัญชีใหม่ที่สร้างใน browser test ไม่อ่าน `.env` หรือใช้บัญชี LINE/AI จริง ไม่ deploy ไม่ push และไม่ merge

ผลอัตโนมัติผ่านตามหลักฐานที่ระบุด้านล่าง ไม่พบบั๊กวิกฤตค้างในเส้นทางที่ตรวจ แต่ **ไม่ใช่การรับรองระบบ production ทุกกรณี** คะแนนมนุษย์ การส่งถึง LINE จริง และ latency/ค่าใช้จ่ายของ provider จริงยังไม่วัด

## สิ่งที่พบและแก้แล้ว

| ประเด็น | ประเภท/ระดับ | หลักฐานก่อนแก้ | วิธีแก้และตรวจซ้ำ |
|---|---|---|---|
| ถาม “รับโอนธนาคารอะไร” แล้วตอบรายละเอียดร้านทั้งที่ไม่มีข้อมูลธนาคาร | Functional / Medium | [baseline-results.json](../reports/task11/baseline-results.json): coffee-payment ไม่ผ่าน; ทั้งชุด 27/28 | NFKC แยกสระอำใน “สำหรับ” แล้ว Intl.Segmenter ตัดเป็น “รับ” จนเกิด false match คืนรูปสระอำเฉพาะตอนตัดคำ ไม่เปลี่ยน embeddings เดิม; regression ทดสอบทั้งไม่มีข้อมูลและเพิ่ม policy ธนาคารจริงแล้วตอบถูก ชุดเดิมผ่าน 28/28 โดยไม่เปลี่ยนเฉลย |
| กรอก LINE credentials เร็วหลังเปิดแท็บ แล้ว GET ที่มาช้าล้างค่าที่เพิ่งพิมพ์ | Functional / Medium | [browser baseline](../reports/task11/browser-baseline-results.json), [ภาพก่อนแก้](../reports/task11/screenshots/line-settings-race-before.png): Secret ว่าง ไม่มี PUT และ webhook ตอบ LINE_NOT_CONFIGURED | ล็อกช่องกรอก/บันทึกจนโหลดค่าปัจจุบันเสร็จ ใช้ request version กันผลโหลดเก่า และจับ shopId ตอนบันทึก; DOM/HTTP regression กับ deferred GET และ Chrome flow ผ่าน |
| หน้าแรกยังบอกบทสนทนา/รับช่วงเป็นแผนอนาคต ทั้งที่ใช้งานได้แล้ว | Content / Low | HomeJourney และ regression แสดง “อยู่ในแผนพัฒนา” | แสดงการ์ดบทสนทนาพร้อม Pause/Resume และทางเข้าผ่าน /app; regression และ browser กลับหน้า home ผ่าน |

ตรวจ dependency audit แยกจากบั๊กที่ reproduce ในแอป: ก่อนแก้พบ 3 packages (Critical 1 / High 2) ตาม [audit ก่อนแก้](../reports/task11/dependency-audit-before.json) ไม่ได้พิสูจน์ exploit บนแอปนี้ อัปเดต Next 16.3.5 → **16.3.8**, sharp 0.35.4 → **0.35.5**, source-map-js 1.2.1 → **1.2.2** และตรวจ [audit หลังแก้](../reports/task11/dependency-audit-after.json) ได้ **0** ทุกระดับ ไม่ใช้ `audit fix --force`

อ้างอิง advisory: [Next ImageResponse](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j), [Next Image Optimization](https://github.com/advisories/GHSA-cjq9-62q9-8jv4), [sharp/librsvg](https://github.com/advisories/GHSA-wq5f-xc86-pv6w), [source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) การแก้ dependency ไม่ใช่หลักฐานว่าแอปเคยถูกโจมตี

## ผลวัดซ้ำได้

รายละเอียด expected/actual, source IDs, rubric รายมิติ, Node/Next/PostgreSQL version และเวลา UTC อยู่ใน [results.json](../reports/task11/results.json) พร้อม [รายงานที่สร้างจากการรันจริง](../reports/task11/report.md)

| กลุ่ม | ผล | วิธีตรวจ |
|---|---|---|
| คำถามเทียบเฉลย | 28/28 | FAQ/สินค้า/นโยบาย/ข้อมูลร้าน, คำถามถอดความ, ไม่มีข้อมูล, draft และคำถามสินค้าของอีกร้าน |
| Correctness / Relevance / Grounded / Tenant isolation | แต่ละมิติผ่าน 28/28 | ตรวจ facts ตามเฉลย / source ID ตรงหัวข้อ / ข้อความเป็น excerpt บวก persona template หรือปฏิเสธตามมาตรฐาน / แหล่งข้อมูลร้านเดียวกัน |
| AI HTTP boundary / Failover | 7/7 | คำตอบถูกต้อง, 503, JSON เสีย, คำตอบไร้หลักฐาน, source อีกร้าน, insufficient และ timeout จริง 10 วินาที |
| Handover | 7/7 | รับช่วง, ไม่ตอบขณะ human, admin push+idempotency, Resume, webhook ซ้ำ, ยกเลิก AI ระหว่าง Pause→Resume และสิทธิ์ร้าน/session |
| Chrome headless จริง | 11 ขั้นตอนผ่าน / page errors 0 | สมัคร→สร้างร้าน→เผยแพร่ FAQ→LINE Simulator→signed webhook→รับช่วงด้วยคีย์บอร์ด→ส่ง agent→Pause/Resume→มือถือ→กลับ home→logout/login |
| Runtime regression | 99/99 | รวม API contracts, tenant, session/remount, UI async, durable worker/lease/crash, RAG และ regression ใหม่ |
| Schema/PostgreSQL/import/backup/production/LINE lifecycle | 19/19 | migration checksum/rollback/FK/cascade, import และ server restart/maintenance/worker shutdown |

Chrome ใช้ production Next frontend จริง แต่ส่งคำขอ API ของ browser ไป HTTP service จริงที่ฉีด LINE test transport ไว้ ไม่ใช่ production LINE channel; production API runtime/CLI ตรวจแยกใน integration smoke ข้างต้น

## เวลาและค่าใช้จ่าย

- วัดเวลา local ตั้งแต่ส่ง signed webhook จน worker ส่งผ่าน test transport และ commit ประวัติแล้ว อ่าน p50/p95/max จาก `results.json` และรายเคสจาก `report.md` ไม่รวมเครือข่าย LINE/โมเดลภายนอกหรือเวลาคิดของแอดมิน และไม่ใช่ production SLA
- ค่าเรียก API ภายนอกของการทดสอบรอบนี้ **0 USD**: ไม่มีคำขอ LINE/AI ออกภายนอก ใช้ LINE transport ที่ฉีดไว้และ HTTP generator ใน loopback; จำนวน local boundary requests เก็บตามจริง
- ค่า hosting/ไฟฟ้า/โควตา LINE และ token ของโมเดลจริง **ยังไม่วัด** ไม่แปลงค่าที่ไม่ทราบเป็นศูนย์ และไม่ประมาณ invoice จากข้อมูลสมมติ

## หลักฐานหน้าจอ

- [ผล Chrome และ network status](../reports/task11/browser-results.json)
- [บทสนทนาเดสก์ท็อป 1440px](../reports/task11/screenshots/conversations-desktop.png)
- [บทสนทนามือถือ 390px](../reports/task11/screenshots/conversations-mobile.png)
- [หน้าแรกหลัง login บนมือถือ](../reports/task11/screenshots/home-mobile-signed-in.png)

ตรวจภาพหน้าบทสนทนาแล้ว ข้อความ/ปุ่มอยู่ในกรอบ มือถือไม่มี document horizontal overflow; แถบเมนูตั้งค่ามี horizontal scroll ภายในตามแบบเดิม ตรวจคีย์บอร์ด activation รับช่วงและการส่งข้อความ แต่ยังไม่ใช่ accessibility audit เต็มรูปแบบหรือการทดสอบทุก browser/device

## รันซ้ำ

ใช้ Node **24.19.0**, npm **11.19.0**, PostgreSQL **18** และค่าทดสอบตาม `integration/postgresql-fixture.js`: `TEST_DATABASE_URL` ต้องเป็น loopback/ฐาน `chatbot_test` และต่างจาก runtime พร้อม `DB_SSL_MODE=disable` ไม่ตั้งค่าชี้ฐานผู้ใช้เพื่อให้ tests ผ่าน

```text
npm ci
npm run check:toolchain
npm run test:runtime
npm run test:evaluation
npm run test:sqlite
npm run test:import
npm run test:postgres
npm run test:postgres:schema
npm run build
npm run test:browser
npm run test:line:runtime
npm run test:production
npm run api:check
npm audit --audit-level=high
```

Browser ใช้ Chrome ที่ติดตั้งในเครื่องโดย default หากใช้ bundled Chromium รัน `npx playwright install chromium` แล้วกำหนด `PLAYWRIGHT_CHANNEL=chromium` ก่อน `npm run test:browser` บน Linux อาจต้องใช้ `npx playwright install --with-deps chromium` ตาม CI ผลถูกเขียนใหม่ใน `reports/task11/` หรือเปลี่ยนด้วย `EVALUATION_REPORT_DIR`; แต่ละรอบสร้าง schema ใหม่และลบเฉพาะ schema ของตัวเอง

CI เพิ่ม evaluation, browser และ audit gates พร้อมเก็บ `reports/ci-task11/` เป็น artifact แม้ job ล้มเหลว ใช้ output แยกจากผลที่บันทึกใน Git เพื่อไม่อัปโหลดผลเก่าแทนรอบที่ล้มก่อนเริ่มทดสอบ **ยังไม่ได้อ้างว่าผ่าน remote CI** เพราะงานรอบนี้ไม่ได้ push

## สิ่งที่ยังต้องยืนยันก่อนสาธิตจริง (ข้อ 12)

1. ผู้ทดสอบให้คะแนนคำถาม/คำตอบใน [human-review.csv](../reports/task11/human-review.csv): accuracy 0=ผิด, 1=บางส่วน, 2=ถูก; relevance 0=ผิดเรื่อง, 1=เกี่ยวบางส่วน, 2=ตรงเรื่อง; unsupported yes/no พร้อมชื่อผู้ตรวจและหมายเหตุ เว้นช่องเหล่านี้ว่างโดยตั้งใจ ไม่ใช้คะแนนอัตโนมัติแทนมนุษย์
2. ใช้บัญชี LINE ทดสอบที่ได้รับอนุญาต ทดสอบ bot→รับช่วง→agent push→Pause→Resume และตรวจข้อความที่อุปกรณ์จริง บันทึก event/request ID และเวลาโดยไม่เผย credentials
3. เมื่อเชื่อม AI provider จริง ทดสอบชุดเดิมซ้ำ บันทึก model/version/input-output tokens/ราคาและค่า LINE จาก usage จริง พร้อม p50/p95 ที่รวมเครือข่าย ไม่ใช้เวลาของ mock แทน
4. ตรวจ remote checks ของ commit ที่จะรวม และสิทธิ์ deploy Vercel/Render โดยเจ้าของระบบตาม gate เดิม ไม่แก้ Git author หรือปิด checks เพื่อข้ามข้อจำกัดสิทธิ์
