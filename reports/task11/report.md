# ผลวัดข้อ 11 — fixtures ในเครื่อง

เวลา: 2026-10-19T18:17:22.052Z

**ไม่ใช่ผลจากลูกค้า LINE จริง โมเดล AI จริง หรือคะแนนประเมินโดยมนุษย์**

| กลุ่ม | ผ่าน | ทั้งหมด |
|---|---:|---:|
| quality | 28 | 28 |
| failover | 7 | 7 |
| handover | 7 | 7 |

เวลา webhook → worker → DB (local): p50 84.45 ms, p95 142.11 ms; ไม่รวม LINE network/เวลาคิดของแอดมิน

ค่าเรียก LINE/AI ภายนอกในรอบนี้: 0 USD เพราะใช้ test transport และ local HTTP provider; ค่าใช้งานจริงต่อเดือน/จำนวน tokens ยังไม่วัด

## คำถามและเฉลย

| ID | ผล | เวลา ms | คำตอบจริง (fixture) |
|---|---|---:|---|
| coffee-hours | ผ่าน | 85.75 | ยินดีครับ ร้านบ้านกาแฟเปิดทุกวัน 08:00-18:00 |
| coffee-hours-paraphrase | ผ่าน | 73.37 | ยินดีครับ เวลาเปิดให้บริการ: ทุกวัน 08:00-18:00 |
| coffee-hours-close | ผ่าน | 80.1 | ยินดีครับ เวลาเปิดให้บริการ: ทุกวัน 08:00-18:00 |
| coffee-menu | ผ่าน | 83.63 | ยินดีครับ อเมริกาโนเย็น 60 บาท ลาเต้เย็น 75 บาท ครัวซองต์ 85 บาท |
| coffee-americano | ผ่าน | 79.64 | ยินดีครับ อเมริกาโนเย็น 60 บาท ลาเต้เย็น 75 บาท ครัวซองต์ 85 บาท |
| coffee-croissant | ผ่าน | 68.43 | ยินดีครับ อเมริกาโนเย็น 60 บาท ลาเต้เย็น 75 บาท ครัวซองต์ 85 บาท |
| coffee-delivery | ผ่าน | 91.13 | ยินดีครับ รับสินค้าที่ร้านเท่านั้น ยังไม่มีบริการจัดส่ง |
| coffee-pickup | ผ่าน | 81.48 | ยินดีครับ รับสินค้าที่ร้านเท่านั้น ยังไม่มีบริการจัดส่ง |
| coffee-name | ผ่าน | 182.55 | ยินดีครับ ชื่อร้าน: บ้านกาแฟ |
| coffee-parking | ผ่าน | 142.11 | ขออภัย ยังไม่มีข้อมูลที่ยืนยันคำตอบนี้ได้ กรุณาติดต่อเจ้าหน้าที่ |
| coffee-jobs | ผ่าน | 116.24 | ขออภัย ยังไม่มีข้อมูลที่ยืนยันคำตอบนี้ได้ กรุณาติดต่อเจ้าหน้าที่ |
| coffee-payment | ผ่าน | 84.45 | ขออภัย ยังไม่มีข้อมูลที่ยืนยันคำตอบนี้ได้ กรุณาติดต่อเจ้าหน้าที่ |
| coffee-promotion | ผ่าน | 108.26 | ขออภัย ยังไม่มีข้อมูลที่ยืนยันคำตอบนี้ได้ กรุณาติดต่อเจ้าหน้าที่ |
| coffee-draft | ผ่าน | 92.51 | ขออภัย ยังไม่มีข้อมูลที่ยืนยันคำตอบนี้ได้ กรุณาติดต่อเจ้าหน้าที่ |
| coffee-cross-shop-rose | ผ่าน | 77.9 | ขออภัย ยังไม่มีข้อมูลที่ยืนยันคำตอบนี้ได้ กรุณาติดต่อเจ้าหน้าที่ |
| flower-hours | ผ่าน | 89.9 | ยินดีครับ ร้านบ้านดอกไม้เปิดจันทร์-เสาร์ 09:00-19:00 และปิดวันอาทิตย์ |
| flower-hours-paraphrase | ผ่าน | 90.76 | ยินดีครับ เวลาเปิดให้บริการ: จันทร์-เสาร์ 09:00-19:00 ปิดวันอาทิตย์ |
| flower-sunday | ผ่าน | 90.31 | ยินดีครับ ร้านบ้านดอกไม้เปิดจันทร์-เสาร์ 09:00-19:00 และปิดวันอาทิตย์ |
| flower-rose | ผ่าน | 78.71 | ยินดีครับ ช่อกุหลาบเริ่มต้น 590 บาท ช่อดอกไม้รวมเริ่มต้น 390 บาท |
| flower-bouquet | ผ่าน | 100.54 | ยินดีครับ ช่อกุหลาบเริ่มต้น 590 บาท ช่อดอกไม้รวมเริ่มต้น 390 บาท |
| flower-delivery | ผ่าน | 103.58 | ยินดีครับ จัดส่งภายในเมือง ค่าจัดส่ง 50 บาท กรุณาสั่งล่วงหน้า 1 วัน |
| flower-delivery-price | ผ่าน | 74.56 | ยินดีครับ จัดส่งภายในเมือง ค่าจัดส่ง 50 บาท กรุณาสั่งล่วงหน้า 1 วัน |
| flower-delivery-advance | ผ่าน | 66.02 | ยินดีครับ จัดส่งภายในเมือง ค่าจัดส่ง 50 บาท กรุณาสั่งล่วงหน้า 1 วัน |
| flower-name | ผ่าน | 54.49 | ยินดีครับ ชื่อร้าน: บ้านดอกไม้ |
| flower-parking | ผ่าน | 70.74 | ขออภัย ยังไม่มีข้อมูลที่ยืนยันคำตอบนี้ได้ กรุณาติดต่อเจ้าหน้าที่ |
| flower-refund | ผ่าน | 85.15 | ขออภัย ยังไม่มีข้อมูลที่ยืนยันคำตอบนี้ได้ กรุณาติดต่อเจ้าหน้าที่ |
| flower-wifi | ผ่าน | 97.15 | ขออภัย ยังไม่มีข้อมูลที่ยืนยันคำตอบนี้ได้ กรุณาติดต่อเจ้าหน้าที่ |
| flower-cross-shop-coffee | ผ่าน | 81.64 | ขออภัย ยังไม่มีข้อมูลที่ยืนยันคำตอบนี้ได้ กรุณาติดต่อเจ้าหน้าที่ |

## Failover

- valid: ผ่าน / generator / 78.76 ms
- http503: ผ่าน / extractive / 81.65 ms
- malformed: ผ่าน / extractive / 91.34 ms
- unsupported: ผ่าน / extractive / 111.14 ms
- foreign-source: ผ่าน / extractive / 104.77 ms
- insufficient: ผ่าน / no_evidence / 155.14 ms
- slow: ผ่าน / extractive / 10131.32 ms

## Handover

- takeover: ผ่าน / 16.02 ms
- no_bot_while_human: ผ่าน
- agent_push_and_idempotency: ผ่าน / 51.89 ms
- resume_fresh_event: ผ่าน / 59.79 ms
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
