# ผลวัดข้อ 11 — fixtures ในเครื่อง

เวลา: 2026-10-17T19:23:43.031Z

**ไม่ใช่ผลจากลูกค้า LINE จริง โมเดล AI จริง หรือคะแนนประเมินโดยมนุษย์**

| กลุ่ม | ผ่าน | ทั้งหมด |
|---|---:|---:|
| quality | 28 | 28 |
| failover | 7 | 7 |
| handover | 7 | 7 |

เวลา webhook → worker → DB (local): p50 114.35 ms, p95 157.9 ms; ไม่รวม LINE network/เวลาคิดของแอดมิน

ค่าเรียก LINE/AI ภายนอกในรอบนี้: 0 USD เพราะใช้ test transport และ local HTTP provider; ค่าใช้งานจริงต่อเดือน/จำนวน tokens ยังไม่วัด

## คำถามและเฉลย

| ID | ผล | เวลา ms | คำตอบจริง (fixture) |
|---|---|---:|---|
| coffee-hours | ผ่าน | 174.04 | ยินดีครับ ร้านบ้านกาแฟเปิดทุกวัน 08:00-18:00 |
| coffee-hours-paraphrase | ผ่าน | 145.31 | ยินดีครับ เวลาเปิดให้บริการ: ทุกวัน 08:00-18:00 |
| coffee-hours-close | ผ่าน | 127.81 | ยินดีครับ เวลาเปิดให้บริการ: ทุกวัน 08:00-18:00 |
| coffee-menu | ผ่าน | 114.35 | ยินดีครับ อเมริกาโนเย็น 60 บาท ลาเต้เย็น 75 บาท ครัวซองต์ 85 บาท |
| coffee-americano | ผ่าน | 130.54 | ยินดีครับ อเมริกาโนเย็น 60 บาท ลาเต้เย็น 75 บาท ครัวซองต์ 85 บาท |
| coffee-croissant | ผ่าน | 112.54 | ยินดีครับ อเมริกาโนเย็น 60 บาท ลาเต้เย็น 75 บาท ครัวซองต์ 85 บาท |
| coffee-delivery | ผ่าน | 111.19 | ยินดีครับ รับสินค้าที่ร้านเท่านั้น ยังไม่มีบริการจัดส่ง |
| coffee-pickup | ผ่าน | 105.92 | ยินดีครับ รับสินค้าที่ร้านเท่านั้น ยังไม่มีบริการจัดส่ง |
| coffee-name | ผ่าน | 127.42 | ยินดีครับ ชื่อร้าน: บ้านกาแฟ |
| coffee-parking | ผ่าน | 113.81 | ขออภัย ยังไม่มีข้อมูลที่ยืนยันคำตอบนี้ได้ กรุณาติดต่อเจ้าหน้าที่ |
| coffee-jobs | ผ่าน | 131.29 | ขออภัย ยังไม่มีข้อมูลที่ยืนยันคำตอบนี้ได้ กรุณาติดต่อเจ้าหน้าที่ |
| coffee-payment | ผ่าน | 127.25 | ขออภัย ยังไม่มีข้อมูลที่ยืนยันคำตอบนี้ได้ กรุณาติดต่อเจ้าหน้าที่ |
| coffee-promotion | ผ่าน | 157.9 | ขออภัย ยังไม่มีข้อมูลที่ยืนยันคำตอบนี้ได้ กรุณาติดต่อเจ้าหน้าที่ |
| coffee-draft | ผ่าน | 122.65 | ขออภัย ยังไม่มีข้อมูลที่ยืนยันคำตอบนี้ได้ กรุณาติดต่อเจ้าหน้าที่ |
| coffee-cross-shop-rose | ผ่าน | 113.3 | ขออภัย ยังไม่มีข้อมูลที่ยืนยันคำตอบนี้ได้ กรุณาติดต่อเจ้าหน้าที่ |
| flower-hours | ผ่าน | 119.55 | ยินดีครับ ร้านบ้านดอกไม้เปิดจันทร์-เสาร์ 09:00-19:00 และปิดวันอาทิตย์ |
| flower-hours-paraphrase | ผ่าน | 132.67 | ยินดีครับ เวลาเปิดให้บริการ: จันทร์-เสาร์ 09:00-19:00 ปิดวันอาทิตย์ |
| flower-sunday | ผ่าน | 105.41 | ยินดีครับ ร้านบ้านดอกไม้เปิดจันทร์-เสาร์ 09:00-19:00 และปิดวันอาทิตย์ |
| flower-rose | ผ่าน | 110.07 | ยินดีครับ ช่อกุหลาบเริ่มต้น 590 บาท ช่อดอกไม้รวมเริ่มต้น 390 บาท |
| flower-bouquet | ผ่าน | 103.52 | ยินดีครับ ช่อกุหลาบเริ่มต้น 590 บาท ช่อดอกไม้รวมเริ่มต้น 390 บาท |
| flower-delivery | ผ่าน | 115.85 | ยินดีครับ จัดส่งภายในเมือง ค่าจัดส่ง 50 บาท กรุณาสั่งล่วงหน้า 1 วัน |
| flower-delivery-price | ผ่าน | 113.88 | ยินดีครับ จัดส่งภายในเมือง ค่าจัดส่ง 50 บาท กรุณาสั่งล่วงหน้า 1 วัน |
| flower-delivery-advance | ผ่าน | 106.65 | ยินดีครับ จัดส่งภายในเมือง ค่าจัดส่ง 50 บาท กรุณาสั่งล่วงหน้า 1 วัน |
| flower-name | ผ่าน | 106.14 | ยินดีครับ ชื่อร้าน: บ้านดอกไม้ |
| flower-parking | ผ่าน | 102.63 | ขออภัย ยังไม่มีข้อมูลที่ยืนยันคำตอบนี้ได้ กรุณาติดต่อเจ้าหน้าที่ |
| flower-refund | ผ่าน | 121.44 | ขออภัย ยังไม่มีข้อมูลที่ยืนยันคำตอบนี้ได้ กรุณาติดต่อเจ้าหน้าที่ |
| flower-wifi | ผ่าน | 128.4 | ขออภัย ยังไม่มีข้อมูลที่ยืนยันคำตอบนี้ได้ กรุณาติดต่อเจ้าหน้าที่ |
| flower-cross-shop-coffee | ผ่าน | 109.71 | ขออภัย ยังไม่มีข้อมูลที่ยืนยันคำตอบนี้ได้ กรุณาติดต่อเจ้าหน้าที่ |

## Failover

- valid: ผ่าน / generator / 109.58 ms
- http503: ผ่าน / extractive / 119.53 ms
- malformed: ผ่าน / extractive / 129.97 ms
- unsupported: ผ่าน / extractive / 125.37 ms
- foreign-source: ผ่าน / extractive / 117.17 ms
- insufficient: ผ่าน / no_evidence / 104.55 ms
- slow: ผ่าน / extractive / 10125.96 ms

## Handover

- takeover: ผ่าน / 20.88 ms
- no_bot_while_human: ผ่าน
- agent_push_and_idempotency: ผ่าน / 45.44 ms
- resume_fresh_event: ผ่าน / 104.74 ms
- duplicate_webhook_no_resend: ผ่าน
- pause_resume_cancels_pending_ai: ผ่าน
- tenant_and_session_guards: ผ่าน

## ข้อจำกัด

- Automatic fixture rubric, not a human quality score or production accuracy estimate
- Local elapsed times include webhook, queue processing and DB checkpoint; exclude LINE network, device receipt and human thinking
- This runner does not test browser rendering; see the separate browser-results.json. No real LINE or paid AI model test
- Host electricity/hosting fees and production token/LINE billing were not measured

เกณฑ์อัตโนมัติ: correctness ตรวจ facts จากเฉลย, relevance ตรวจ source ID ตามหัวข้อที่คาดไว้, grounded ตรวจข้อความเป็น excerpt ของหลักฐานบวก persona template และ no_evidence ตรงข้อความปฏิเสธ ไม่ใช่การให้คะแนนเชิงความหมายโดยคน

ดู expected/actual และผลรายมิติใน [results.json](results.json)
