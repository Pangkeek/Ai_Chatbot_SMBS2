import { button, field, label, section } from './styles';
export default function RequestSection() {
  return (
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
  );
}
