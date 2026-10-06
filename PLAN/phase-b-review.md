# รีวิวระยะ B — PostgreSQL development และ database layer

วันที่: 6 ตุลาคม 2026 (Asia/Bangkok)  
Branch: `codex/postgresql-render-migration`

## ผลลัพธ์และขอบเขต

เพิ่ม PostgreSQL async layer ใน `src/lib/db.js` ใช้ `pg` **8.23.1** แบบ pin พร้อม npm lockfile และทดสอบกับ PostgreSQL **18.4** จริง แยก `chatbot_dev` กับ `chatbot_test` ใน cluster ใหม่ `data/postgresql-phase-b` ที่ loopback port **55432** ไม่แตะ SQLite source/backup ระยะ A

API/auth/services ยังใช้ SQLite อย่างชัดเจนผ่าน `src/lib/sqlite.js` ซึ่งย้ายมาจาก module เดิมโดยไม่เปลี่ยน logic; ไม่มี automatic engine fallback ใน PostgreSQL layer การสลับ API runtime และยกเลิก SQLite runtime จะทำระยะ D หลังมี schema ระยะ C ดังนั้นเกณฑ์ runtime ทั้งแอป fail เมื่อไม่มี DATABASE_URL ยังไม่เปิดใช้กับ API เดิม แต่ PostgreSQL layer ใหม่นี้ fail แล้ว

## สิ่งที่เพิ่ม

- `openDatabase(config?)` ตรวจ connection โดยไม่รัน DDL/migration/seed; `query`, `transaction` และ `close` เป็น async
- Transaction ใช้ client เดียว, await callback, rollback เมื่อผิดพลาด, release ใน finally และทิ้ง client เมื่อ rollback/connection เสีย
- ป้องกัน pool query, nested transaction และ close บน DB เดียวกันภายใน callback; ปฏิเสธใช้ tx หลังสิ้นสุด
- ตรวจกรณี callback กลืน SQL error แล้ว PostgreSQL เปลี่ยน COMMIT เป็น ROLLBACK ไม่รายงานว่าสำเร็จ
- Runtime singleton ใช้ global symbol + initialization promise รองรับ concurrent first requests/hot reload; เปิด connection แบบ lazy สำหรับเชื่อมในระยะ D
- Pool idle errors ไม่ log driver error หรือ credentials; connection failure ส่งข้อความทั่วไปที่ไม่มี URL/password
- Config ตรวจ URL, integer limits, TLS mode และห้าม URL parameters override SSL; ใช้ server-side statement timeout
- Compose PostgreSQL 18 พร้อม named volume และ init test DB; `.env.example`, README และ scripts โหลด `.env`
- เพิ่มค่าตั้งต้น PostgreSQL ที่ยังไม่มีลง `.env` local โดยเก็บค่าเดิมไว้; ไฟล์นี้ไม่เข้า Git

## การทดสอบ

| การตรวจ | ผล |
|---|---|
| `npm test` | 26/26 ผ่าน ไม่มี skipped |
| `npm run test:postgres` | 2 integration groups ผ่านบน PostgreSQL 18.4 ไม่มี skipped |
| `npm run db:check:postgres` | ต่อ `chatbot_dev` สำเร็จและปิด pool |
| `npm run api:check` | ผ่าน |
| `npm run build` | ผ่าน |
| `git diff --check` | ผ่าน |

Integration tests ใช้ pool max=1 เพื่อให้ client leak ทำให้การทดสอบถัดไปล้มเหลว ครอบคลุม 12 concurrent queries, parameterized Unicode, async commit, callback exception, SQL error rollback, swallowed error, statement timeout, dead connection/rollback failure recovery, use-after-transaction, close ซ้ำ, query หลัง close, connection failure และ singleton/hot reload/reopen

Tests ต้องระบุ `TEST_DATABASE_URL` เป็น loopback `/chatbot_test` และไม่ใช้ DB เดียวกับ DATABASE_URL; ถ้าขาดหรือผิดจะ fail ก่อนเขียนข้อมูล สร้างตารางชื่อสุ่มและลบทิ้งใน finally ไม่ล้าง database ระยะ B แยก integration command จาก `npm test`; PostgreSQL CI เป็นงานระยะ G

## เปิดใช้งาน local ซ้ำ

Cluster ที่สร้างในเครื่องนี้ใช้ role `chatbot` และรหัสผ่านตัวอย่าง local ตาม `.env.example`; ตั้ง host authentication เป็น SCRAM แล้ว PostgreSQL process ฟังเฉพาะ loopback ไม่ใช่ production setup

หาก server หยุดแล้ว เปิดด้วย PowerShell:

```powershell
& 'C:/Program Files/PostgreSQL/18/bin/pg_ctl.exe' -D data/postgresql-phase-b -l data/postgresql-phase-b/server.log -o '-h 127.0.0.1 -p 55432' -w start
npm run db:check:postgres
npm run test:postgres
```

หยุดเฉพาะ cluster นี้เมื่อเลิกใช้:

```powershell
& 'C:/Program Files/PostgreSQL/18/bin/pg_ctl.exe' -D data/postgresql-phase-b -m fast -w stop
```

อีกทางเลือกคือ `docker compose up -d postgres` หลังหยุด native cluster เพื่อไม่ให้พอร์ตชนกัน Docker CLI ไม่มีในเครื่องนี้ จึงยังไม่ได้ทดสอบเส้นทาง Compose จริง ข้อมูล native และ Docker อยู่คนละ volume ไม่ได้แชร์กัน

## ข้อจำกัดและผลรีวิว

ผ่านเกณฑ์ database layer ของ B ที่ทดสอบบน local PostgreSQL ไม่พบ connection leak ในกรณีทดสอบ พบและแก้ checked-out client error ระหว่าง forced disconnect แล้ว ยังไม่ได้ทดสอบ TLS กับ Render endpoint จริง ไม่ได้สร้าง cloud service หรือย้ายข้อมูล

ยังไม่มี PostgreSQL business schema/migration runner (C), API async switch (D), import (E), durable queue (F) หรือ PostgreSQL CI (G) ใช้ npm lockfile ที่ปรับแล้วสำหรับ dependency ใหม่; pnpm lockfile เดิมยังไม่อัปเดตและจะเลิกดูแลเมื่อปรับ CI ตามแผน ห้ามใช้ pnpm install กับ branch นี้

อ้างอิงการจัดการ connection/SSL: [node-postgres Pool](https://node-postgres.com/apis/pool), [SSL](https://node-postgres.com/features/ssl)
