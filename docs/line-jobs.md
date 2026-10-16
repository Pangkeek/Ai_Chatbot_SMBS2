# ดูแล durable LINE jobs

Server ใช้ `LINE_WORKER_ENABLED=true` เพื่อเปิด consumer 1 ตัวต่อ process ผ่าน Next.js instrumentation hook ปิดด้วย false ใน build/tests หรือบริการที่ไม่ควรตอบ LINE `npm run build` บังคับ false ใน child process เสมอ ไม่ต้องตั้ง DATABASE_URL เพื่อ build

Production ใช้ `npm start` ซึ่งเรียก Next CLI ที่ `0.0.0.0` และอ่าน PORT จาก environment พร้อม manual signal handling เมื่อ SIGTERM/SIGINT จะหยุด claim, รอ active job สูงสุด 15 วินาทีและปิด pool หากหยุดไม่ทันหรือ DB ไม่พร้อมจะให้ process exit ภายใน 15 วินาที งานที่เหลือฟื้นจาก lease เมื่อเริ่ม server ใหม่ Manual shutdown นี้ใช้ production start; next dev ใช้ lifecycle ของ Next dev และต้องพึ่ง lease recovery เมื่อถูกหยุด

Consumer poll ทุก 1 วินาทีและปลุกเมื่อ webhook commit แล้ว ใช้ lease 60 วินาที/heartbeat 15 วินาที ทุก checkpoint ตรวจ owner และ lease อีกครั้ง การ claim ใช้ SKIP LOCKED และการสร้าง conversation ใช้ shop/customer advisory lock ข้อความใช้ ID ที่คำนวณจาก shop/event/role

Webhook ที่เป็น text ต้องมี webhookEventId หรือ message ID, userId และ text ที่ประมวลผลได้ Event ที่ไม่รองรับจะเก็บ ignored โดยไม่มี job; event ที่ไม่มี ID จะตอบ 422 ทั้ง batch แทนสร้าง ID สุ่ม Event ID ที่ชนกับร้านอื่นตอบ 409 โดยไม่เปิดเผยร้านเดิม `processed_count` หมายถึงจำนวน text jobs ใหม่ที่ commit สำเร็จ ไม่ใช่จำนวนคำตอบที่ส่งแล้ว

## นโยบาย delivery

| กรณี | ผล |
|---|---|
| bot paused/human หรือ conversation closed ก่อนส่ง | เก็บ customer message แล้ว completed/BOT_INACTIVE ไม่มี reply |
| รับ webhook มาเกิน 45 วินาทีก่อนเริ่มส่ง | failed/REPLY_WINDOW_EXPIRED เก็บ customer message ไม่มี push ทดแทน |
| DB/transient failure ก่อนส่ง | retry ได้ถึง 3 attempts, backoff 1 และ 3 วินาที ภายใน cutoff |
| LINE ตอบ non-2xx ชัดเจน | failed/LINE_HTTP_REJECTED ไม่ retry |
| HTTP timeout/disconnect | unknown/DELIVERY_UNCERTAIN ไม่ retry |
| LINE สำเร็จ แต่ DB บันทึก assistant/checkpoint ไม่สำเร็จ | unknown หรือคง processing/sending จน lease recovery เปลี่ยนเป็น unknown ไม่มี assistant ที่แสดงว่าส่งสำเร็จ |
| crash ก่อน checkpoint sending | กลับ pending หลัง lease หมด รักษา customer/reply checkpoints |
| crash หลัง checkpoint sending | unknown หลัง lease หมด ห้ามส่งใหม่อัตโนมัติ |

HTTP timeout 10 วินาที ไม่มี transaction ถือค้างระหว่างสร้างคำตอบหรือเรียก LINE Credentials อ่านใหม่จาก line_channels ตอนทำงาน ไม่เก็บใน payload `line_events` คง enum เดิม: unknown ใน job จะสะท้อน failed ใน event จึงต้องดู line_jobs เพื่อแยกผลไม่แน่นอน

ระบบไม่รับรอง exactly-once delivery ข้าม PostgreSQL/LINE Reply cutoff 45 วินาทีเป็น policy ของแอป ไม่ใช่การรับรองอายุ reply token อ่านข้อจำกัดและ redelivery ใน [LINE webhook guide](https://developers.line.biz/en/docs/messaging-api/receiving-messages/) และ [Messaging API reference](https://developers.line.biz/en/reference/messaging-api/)

## ตรวจคิวโดยไม่อ่านข้อมูลลับ

```sql
SELECT status, delivery_state, count(*)
FROM line_jobs GROUP BY status, delivery_state;

SELECT job_id, shop_id, event_id, status, delivery_state, attempts,
       received_at, available_at, lease_until, last_error_code
FROM line_jobs
WHERE status IN ('pending', 'processing', 'failed', 'unknown')
ORDER BY received_at;

-- Imported historical events deliberately have no job; never auto-replay them.
SELECT e.shop_id, e.event_id, e.status
FROM line_events e
LEFT JOIN line_jobs j ON j.shop_id=e.shop_id AND j.event_id=e.event_id
WHERE e.status IN ('received','processing') AND j.job_id IS NULL;
```

Logs มีเพียง error code/job ID ไม่มี payload, reply text, token หรือ DB URL ตรวจ unknown กับ LINE Console และข้อมูลที่ผู้ดูแลมี ห้ามแก้ unknown/sending ให้ pending หรือ replay โดยไม่ตรวจ เพราะอาจส่งซ้ำ ไม่มี public retry endpoint หรือ UI จัดการคิว

## Retention

รัน `npm run db:cleanup:line` กับ DATABASE_URL ที่ตั้งใจเพื่อเคลียร์ payload/reply_text ของ terminal jobs ที่จบเกิน 30 วัน และ reply_token ของ events ที่เกี่ยวข้อง เก็บ IDs/checkpoints/messages/event history เพื่อ deduplication ไม่แตะ pending/processing ไม่ cleanup อัตโนมัติระหว่าง startup การตั้งรอบรันบน Render เป็นงานของผู้ใช้

## ตรวจสอบ

`npm test` ทดสอบ producer, concurrency, leases, delivery failures, crash/recovery และ retention กับ PostgreSQL จริง หลัง `npm run build` รัน `npm run test:line:runtime` เพื่อทดสอบ Next startup โดยไม่มี request แรก, worker flag, health และ shutdown Tests ใช้ schema สุ่มใน chatbot_test และ fixture/mock LINE ไม่ส่งข้อความจริง

บน Windows lifecycle test ส่ง Node signal event ผ่าน IPC เพราะ OS ไม่ส่ง POSIX signals แบบ Linux; CI Linux ส่ง SIGTERM/SIGINT จริง ต้องตรวจ deploy/restart และ LINE channel ทดสอบบน Render อีกครั้งในระยะ G

## RAG evidence และ restart

Migration 004 เพิ่ม reply_sources/reply_method ลง line_jobs เก็บคำตอบและหลักฐานใน checkpoint ก่อนส่ง HTTP และบันทึก message_sources พร้อม assistant message หลังส่งสำเร็จ งานที่ recover ก่อนส่งใช้หลักฐานเดิมแม้ความรู้ถูกแก้หรือลบ ไม่ส่งซ้ำเมื่อ delivery เป็น unknown Retention ล้าง reply_sources ของ terminal jobs เก่าพร้อม payload/reply_text แต่เก็บ message_sources เป็น audit ตามบทสนทนา
