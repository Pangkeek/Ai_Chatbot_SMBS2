# รันระบบบนเครื่อง

ใช้ Node.js 24.19.0, npm 11.19.0 และ Docker Desktop ระบบเว็บฟังเฉพาะ `127.0.0.1:3131` ฐาน PostgreSQL 18 ฟังเฉพาะ `127.0.0.1:55434` ข้อมูลอยู่ใน Docker volume `smb-chatbot-local_postgres_local_data` และแยกจาก Compose เดิมของโครงการ

## เริ่มครั้งแรก

เปิด Docker Desktop และ PowerShell ในโฟลเดอร์โครงการ แล้วรัน:

```powershell
& ./scripts/local-start.ps1 -SeedDemo
```

สคริปต์ใช้ Node 24.19.0 ที่ติดตั้งบนเครื่องนี้และ npm 11.19.0, คัดลอก `.env.local.example` เป็น `.env` เฉพาะเมื่อยังไม่มี, ตรวจว่า URL ชี้ฐาน local, เปิด PostgreSQL, ติดตั้ง dependencies ถ้ายังไม่มี, รัน migration แล้วเปิดเว็บ หากใช้เครื่องอื่นให้ติดตั้ง Node.js 24.19.0 และ npm 11.19.0 ก่อน

เปิด `http://127.0.0.1:3131` บัญชีข้อมูลสมมติ: `coffee@example.test` หรือ `flower@example.test` รหัส `DemoPass!2026` สร้างบัญชีของตนเองผ่านหน้าเว็บได้ `-SeedDemo` ใช้เฉพาะสาธิตบนเครื่องและรันซ้ำได้ ไม่จำเป็นสำหรับร้านจริงที่สร้างผ่านหน้าเว็บ

หาก PowerShell ไม่ยอมรันไฟล์ `.ps1` ให้ตั้ง ExecutionPolicy เฉพาะ process นี้ด้วย `Set-ExecutionPolicy -Scope Process Bypass` แล้วเรียกสคริปต์อีกครั้ง

## เปิดครั้งต่อไปและหยุด

```powershell
& ./scripts/local-start.ps1
```

หยุดเว็บด้วย `Ctrl+C` ในหน้าต่างที่รัน Next.js หยุดฐานด้วย `docker compose -f compose.local.yaml -p smb-chatbot-local down` คำสั่ง `down` ปกติไม่ลบ volume ห้ามใช้ `down --volumes` หากต้องการเก็บข้อมูล ไม่ต้องสั่ง `db:seed` ทุกครั้ง

ตรวจสุขภาพด้วย `http://127.0.0.1:3131/health` หากจะรันคำสั่ง npm เพิ่มเติมใน PowerShell อีกหน้าต่างบนเครื่องนี้ ให้เลือก Node/npm รุ่นที่ถูกต้องก่อน:

```powershell
$env:PATH = (Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin') + ';' + $env:PATH
npm exec --yes --package=npm@11.19.0 -- npm run demo:preflight -- http://127.0.0.1:3131
```

การทดสอบใช้ `TEST_DATABASE_URL` ที่ชี้ `chatbot_test` แยกจาก `chatbot_local`

หลังคัดลอกคีย์ BuddyShare จากหน้าเว็บลง `.env` โดยตรง ให้รัน `npm run ai:check` ด้วย Node/npm รุ่นเดียวกัน คำสั่งนี้ส่งเฉพาะข้อความสมมติ `BLUE` ไปตรวจว่าคีย์และรูปแบบ Responses API ใช้งานได้ หากได้ `AI_HTTP_401` แปลว่าบริการยังไม่ยอมรับคีย์ที่ส่ง อย่าใช้สถานะ `aiConfigured` ในหน้าเว็บเป็นหลักฐานว่า API ผ่าน

## สำรองและกู้ข้อมูล

สร้างไฟล์สำรองใน `data/backups/` ซึ่ง Git ไม่ติดตาม:

```powershell
New-Item -ItemType Directory -Force data/backups | Out-Null
docker exec smb-chatbot-local-postgres-1 pg_dump -U chatbot -d chatbot_local -Fc -f /tmp/chatbot_local.dump
docker cp smb-chatbot-local-postgres-1:/tmp/chatbot_local.dump data/backups/chatbot_local.dump
```

ตรวจไฟล์สำรองก่อนใช้จริงด้วย `docker exec smb-chatbot-local-postgres-1 pg_restore -l /tmp/chatbot_local.dump` คำสั่งกู้คืนควรทดลองลงฐานแยกก่อนเสมอ อย่ากู้ทับ `chatbot_local` ขณะเว็บกำลังใช้งาน ไฟล์สำรองอาจมีข้อมูลลูกค้าและ LINE token ให้เก็บในที่จำกัดสิทธิ์

## ขอบเขตการสาธิต local

หน้า LINE Simulator และชุดทดสอบจำลองแสดง flow รับข้อความ ค้นความรู้ ตอบกลับ บันทึกบทสนทนา และสลับ AI ได้โดยไม่ต้องมี LINE channel หรือ AI API key เมื่อไม่ตั้งคีย์ AI ระบบตอบจากหลักฐานในฐานข้อมูล หากตั้ง `BUDDYSHARE_API_KEY` ใน `.env` จะเรียก Gemini ผ่าน BuddyShare จากฝั่งเซิร์ฟเวอร์; `OPENAI_API_KEY` เป็น AI สำรองแยกต่างหาก ห้ามใส่คีย์ลงไฟล์ที่ Git ติดตาม การรับ webhook จาก LINE จริงต้องมี HTTPS URL ที่ LINE เข้าถึงได้พร้อม channel ของคุณ
