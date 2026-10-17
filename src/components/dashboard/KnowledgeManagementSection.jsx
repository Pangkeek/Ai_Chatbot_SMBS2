import AiContextPreview from "./AiContextPreview.jsx";

export default function KnowledgeManagementSection() {
  return (
    <section
              id="knowledge-management-section"
              className="hidden space-y-6"
              aria-labelledby="knowledge-section-title"
            >
              <div className="outlined-panel rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold tracking-[0.16em] text-blue-600 uppercase">
                      Knowledge Base
                    </p>
                    <h2 id="knowledge-section-title" className="mt-2 text-2xl font-bold text-slate-900">
                      FAQ และข้อมูลความรู้
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                      จัดการคำตอบที่ Chatbot ใช้อ้างอิง แยกเป็นคำถามที่พบบ่อย สินค้า นโยบาย และข้อมูลทั่วไป
                    </p>
                  </div>
                  <button
                    id="knowledge-add-button"
                    type="button"
                    className="app-primary-button inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-300 disabled:cursor-not-allowed"
                  >
                    <span aria-hidden="true">＋</span>
                    เพิ่มข้อมูลความรู้
                  </button>
                </div>

                <div
                  id="knowledge-readonly-notice"
                  className="mt-5 hidden rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800"
                  role="status"
                >
                  บัญชีเจ้าหน้าที่สามารถอ่านและค้นหาข้อมูลได้ แต่เฉพาะเจ้าของร้านเท่านั้นที่เพิ่ม แก้ไข เผยแพร่ หรือลบรายการได้
                </div>

                <dl className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-[#4564c9] p-4 text-white">
                    <dt className="text-xs text-slate-300">ทั้งหมด</dt>
                    <dd id="knowledge-total-count" className="mt-1 text-2xl font-bold">0</dd>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 p-4">
                    <dt className="text-xs font-semibold text-emerald-700">เผยแพร่แล้ว</dt>
                    <dd id="knowledge-published-count" className="mt-1 text-2xl font-bold text-emerald-800">0</dd>
                  </div>
                  <div className="rounded-2xl bg-amber-50 p-4">
                    <dt className="text-xs font-semibold text-amber-700">ฉบับร่าง</dt>
                    <dd id="knowledge-draft-count" className="mt-1 text-2xl font-bold text-amber-800">0</dd>
                  </div>
                </dl>

                <div className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px]">
                  <div>
                    <label htmlFor="knowledge-search" className="sr-only">ค้นหาข้อมูลความรู้</label>
                    <input
                      id="knowledge-search"
                      type="search"
                      placeholder="ค้นหาหัวข้อหรือเนื้อหา…"
                      autoComplete="off"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="knowledge-kind-filter" className="sr-only">กรองตามประเภท</label>
                    <select
                      id="knowledge-kind-filter"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    >
                      <option value="all">ทุกประเภท</option>
                      <option value="faq">คำถามที่พบบ่อย</option>
                      <option value="product">สินค้า/บริการ</option>
                      <option value="policy">นโยบาย</option>
                      <option value="general">ข้อมูลทั่วไป</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="knowledge-status-filter" className="sr-only">กรองตามสถานะ</label>
                    <select
                      id="knowledge-status-filter"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    >
                      <option value="all">ทุกสถานะ</option>
                      <option value="published">เผยแพร่แล้ว</option>
                      <option value="draft">ฉบับร่าง</option>
                    </select>
                  </div>
                </div>
              </div>

              <div id="knowledge-loading" className="grid gap-4" aria-label="กำลังโหลดข้อมูลความรู้">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-36 animate-pulse rounded-2xl bg-slate-200"></div>
                ))}
              </div>

              <div
                id="knowledge-error"
                className="outlined-panel hidden rounded-3xl border border-red-200 bg-white px-6 py-10 text-center shadow-sm"
                role="alert"
              >
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-50 text-xl text-red-600" aria-hidden="true">!</div>
                <h3 className="mt-4 font-bold text-slate-900">โหลดข้อมูลไม่สำเร็จ</h3>
                <p id="knowledge-error-message" className="mt-2 text-sm text-slate-500"></p>
                <button
                  id="knowledge-retry-button"
                  type="button"
                  className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  ลองใหม่
                </button>
              </div>

              <div
                id="knowledge-empty"
                className="outlined-panel hidden rounded-3xl border-2 border-dashed border-slate-200 bg-white px-6 py-12 text-center"
              >
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl text-blue-600" aria-hidden="true">?</div>
                <h3 id="knowledge-empty-title" className="mt-4 text-lg font-bold text-slate-900">ยังไม่มีข้อมูลความรู้</h3>
                <p id="knowledge-empty-message" className="mt-2 text-sm leading-6 text-slate-500">เพิ่มข้อมูลแรกเพื่อให้ Chatbot เริ่มตอบจากข้อมูลของร้าน</p>
              </div>

              <AiContextPreview />

              <div id="knowledge-list" className="grid gap-4"></div>

              <footer
                id="knowledge-pagination"
                className="outlined-panel hidden flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <p id="knowledge-results-summary" className="text-xs text-slate-500" aria-live="polite"></p>
                <div className="flex gap-2">
                  <button id="knowledge-prev-button" type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">ก่อนหน้า</button>
                  <span id="knowledge-page-label" className="min-w-20 self-center text-center text-xs font-semibold text-slate-600"></span>
                  <button id="knowledge-next-button" type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">ถัดไป</button>
                </div>
              </footer>
            </section>
  );
}
