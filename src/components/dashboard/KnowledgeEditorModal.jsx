export default function KnowledgeEditorModal() {
  return (
    <div
        id="knowledge-modal"
        className="fixed inset-0 z-[60] hidden items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="knowledge-modal-title"
      >
        <div className="outlined-panel max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
          <div className="flex items-start justify-between border-b border-slate-100 px-5 py-5 sm:px-7">
            <div>
              <p className="text-xs font-bold tracking-[0.16em] text-blue-600 uppercase">Knowledge editor</p>
              <h2 id="knowledge-modal-title" className="mt-1 text-xl font-bold text-slate-900">เพิ่มข้อมูลความรู้</h2>
            </div>
            <button
              id="knowledge-modal-close"
              type="button"
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-3 focus-visible:outline-blue-300"
              aria-label="ปิดหน้าต่าง"
            >
              ✕
            </button>
          </div>

          <form id="knowledge-form" className="space-y-5 p-5 sm:p-7" noValidate={true}>
            <div>
              <label htmlFor="knowledge-kind" className="mb-2 block text-sm font-semibold text-slate-700">ประเภทข้อมูล</label>
              <select id="knowledge-kind" name="kind" required={true} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
                <option value="faq">คำถามที่พบบ่อย</option>
                <option value="product">สินค้า/บริการ</option>
                <option value="policy">นโยบาย</option>
                <option value="general">ข้อมูลทั่วไป</option>
              </select>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label id="knowledge-title-label" htmlFor="knowledge-title" className="text-sm font-semibold text-slate-700">คำถาม</label>
                <span id="knowledge-title-count" className="text-xs text-slate-400">0/200</span>
              </div>
              <input
                id="knowledge-title"
                name="title"
                type="text"
                required={true}
                maxLength="200"
                aria-describedby="knowledge-title-error"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="เช่น ร้านเปิดกี่โมง"
              />
              <p id="knowledge-title-error" className="mt-2 hidden text-xs font-medium text-red-600"></p>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label id="knowledge-content-label" htmlFor="knowledge-content" className="text-sm font-semibold text-slate-700">คำตอบ</label>
                <span id="knowledge-content-count" className="text-xs text-slate-400">0/20,000</span>
              </div>
              <textarea
                id="knowledge-content"
                name="content"
                rows="8"
                required={true}
                maxLength="20000"
                aria-describedby="knowledge-content-error"
                className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm leading-7 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="เขียนคำตอบที่ชัดเจนและพร้อมให้ Chatbot นำไปใช้"
              ></textarea>
              <p id="knowledge-content-error" className="mt-2 hidden text-xs font-medium text-red-600"></p>
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-slate-700">สถานะ</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 transition has-[:checked]:border-blue-400 has-[:checked]:bg-blue-50">
                  <input type="radio" name="status" value="draft" defaultChecked={true} className="mt-1 accent-blue-600" />
                  <span><strong className="block text-sm text-slate-800">ฉบับร่าง</strong><small className="mt-1 block text-xs leading-5 text-slate-500">เก็บไว้ตรวจสอบก่อน ยังไม่พร้อมใช้อ้างอิง</small></span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 transition has-[:checked]:border-emerald-400 has-[:checked]:bg-emerald-50">
                  <input type="radio" name="status" value="published" className="mt-1 accent-emerald-600" />
                  <span><strong className="block text-sm text-slate-800">เผยแพร่แล้ว</strong><small className="mt-1 block text-xs leading-5 text-slate-500">พร้อมให้ Chatbot ใช้เป็นข้อมูลอ้างอิง</small></span>
                </label>
              </div>
            </fieldset>

            <div id="knowledge-form-error" className="hidden rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert"></div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
              <button id="knowledge-form-cancel" type="button" className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">ยกเลิก</button>
              <button id="knowledge-form-submit" type="submit" className="app-primary-button rounded-xl px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed">บันทึกข้อมูล</button>
            </div>
          </form>
        </div>
      </div>
  );
}
