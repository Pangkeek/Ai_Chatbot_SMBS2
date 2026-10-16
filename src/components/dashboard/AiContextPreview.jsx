export default function AiContextPreview() {
  return (
    <section className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="ai-preview-title">
      <h3 id="ai-preview-title" className="text-xl font-bold text-slate-900">ดูข้อมูลที่ Chatbot ใช้ตอบ</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        ลองพิมพ์คำถามลูกค้าเพื่อดูข้อมูลร้าน หลักฐานที่ค้นพบ และ prompt ที่เตรียมส่งให้บริการ AI โดยใช้เฉพาะความรู้ที่เผยแพร่แล้ว
      </p>
      <form id="ai-preview-form" className="mt-5 flex flex-col gap-3 sm:flex-row">
        <label htmlFor="ai-preview-question" className="sr-only">คำถามตัวอย่างจากลูกค้า</label>
        <input id="ai-preview-question" type="text" maxLength="500" required placeholder="เช่น ร้านขายอะไร หรือเปิดกี่โมง" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
        <button id="ai-preview-button" type="submit" className="app-primary-button rounded-xl px-5 py-3 text-sm font-semibold">ดูข้อมูลที่ใช้</button>
      </form>
      <p id="ai-preview-error" role="alert" className="mt-3 hidden text-sm text-red-600"></p>

      <div id="ai-preview-result" className="mt-6 hidden space-y-5 border-t border-slate-100 pt-5">
        <p id="ai-preview-connection" role="status" className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800"></p>
        <div>
          <h4 className="text-sm font-semibold text-slate-800">ข้อมูลธุรกิจที่บันทึกไว้</h4>
          <div id="ai-preview-business" className="mt-2 space-y-2 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700"></div>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-800">หลักฐานที่เลือกสำหรับคำถามนี้</h4>
          <div id="ai-preview-sources" className="mt-2 space-y-2"></div>
        </div>
        <details className="rounded-xl border border-slate-200 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-blue-700">ดูโครงสร้าง prompt</summary>
          <pre id="ai-preview-prompt" className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100"></pre>
        </details>
      </div>
    </section>
  );
}
