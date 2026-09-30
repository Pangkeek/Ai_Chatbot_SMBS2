import { useApiConsoleController } from "../hooks/useApiConsoleController";

const field =
  "w-full min-w-0 rounded-md border border-[#bac9d2] bg-white p-[11px] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#77cbc4]";
const label = "flex min-w-[240px] flex-1 flex-col gap-2 text-sm font-semibold";
const button =
  "cursor-pointer rounded-md px-[18px] py-3 disabled:cursor-wait disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#77cbc4]";
const section =
  "mb-5 rounded-xl border border-[#dce4e9] bg-white p-5 min-[601px]:p-7";

export default function DocsPage() {
  useApiConsoleController();

  return (
    <div className="min-h-screen bg-[#f2f5f7] font-sans text-[#182a38]">
      <main className="mx-auto max-w-[1000px] px-4 py-7 min-[601px]:px-6 min-[601px]:py-12">
        <header className="mb-8">
          <span className="text-xs font-bold tracking-[1.5px] text-[#086b64]">
            DEVELOPER WORKSPACE · v0.1.0
          </span>
          <h1 className="my-[14px] text-[30px] tracking-[-1px] min-[601px]:text-[40px]">
            SMB Chatbot API
          </h1>
          <p className="leading-[1.7] text-[#495c6b]">
            พื้นที่ทดสอบ API สำหรับทีม · ข้อมูลแยกตามร้าน ·
            บันทึกข้อความในฐานข้อมูลท้องถิ่น
          </p>
          <a className="text-[#086b64] underline" href="/openapi.json">
            ดาวน์โหลด OpenAPI 3.1
          </a>
        </header>
        <section className={section}>
          <h2 className="mb-4 text-xl font-semibold">1. เข้าสู่ระบบ</h2>
          <p className="mb-4 leading-[1.7] text-[#495c6b]">
            รัน seed ก่อนใช้บัญชีตัวอย่าง รหัสผ่านทั้งสองบัญชี:{" "}
            <code>DemoPass!2026</code>
          </p>
          <form id="login" className="flex flex-wrap items-end gap-4">
            <label className={label}>
              อีเมล
              <select id="email" className={field}>
                <option>coffee@example.test</option>
                <option>flower@example.test</option>
              </select>
            </label>
            <label className={label}>
              รหัสผ่าน
              <input
                id="password"
                className={field}
                type="password"
                defaultValue="DemoPass!2026"
                autoComplete="current-password"
              />
            </label>
            <button className={`${button} bg-[#086b64] text-white`}>
              เข้าสู่ระบบ
            </button>
            <button
              id="logout"
              className={`${button} bg-[#e8efef] text-[#244746]`}
              type="button"
            >
              ออกจากระบบ
            </button>
          </form>
          <p
            id="auth-state"
            className="mt-4 [overflow-wrap:anywhere]"
            role="status"
          >
            ยังไม่ได้เข้าสู่ระบบ
          </p>
        </section>
        <section className={section}>
          <h2 className="mb-4 text-xl font-semibold">2. เรียก API</h2>
          <p className="mb-4 leading-[1.7] text-[#495c6b]">
            เข้าสู่ระบบแล้วลอง <code>GET /api/v1/shops</code> เพื่อหา shopId
            จากนั้นเลือก endpoint และใส่ ID ใน path
          </p>
          <form id="request" className="flex flex-wrap items-end gap-4">
            <label className={`${label} basis-full`}>
              Endpoint
              <select id="endpoint" className={field} />
            </label>
            <label className={`${label} basis-full`}>
              Path
              <input
                id="path"
                className={field}
                defaultValue="/api/v1/shops"
                spellCheck="false"
              />
            </label>
            <label className={`${label} basis-full`}>
              JSON body
              <textarea
                id="body"
                className={field}
                rows={7}
                spellCheck="false"
                defaultValue="{}"
              />
            </label>
            <button className={`${button} bg-[#086b64] text-white`}>
              ส่งคำขอ
            </button>
          </form>
          <p
            id="request-state"
            className="my-4 [overflow-wrap:anywhere]"
            role="status"
          />
          <pre
            id="response"
            className="max-h-[600px] overflow-auto rounded-lg bg-[#142834] p-5 text-[13px] leading-[1.7] text-[#d6f3ea]"
          >
            ผลลัพธ์จะปรากฏที่นี่
          </pre>
        </section>
        <footer className="text-[13px] leading-[1.7] text-[#596b77]">
          Console นี้ใช้ทดลอง API ภายในเครื่อง ยังไม่มีการส่งข้อความ LINE
          หรือสร้างคำตอบด้วย AI
        </footer>
      </main>
    </div>
  );
}
