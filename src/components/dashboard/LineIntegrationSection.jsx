import LineSimulator from './LineSimulator.jsx';
export default function LineIntegrationSection() {
  return (
    <section
              id="line-integration-section"
              className="outlined-panel hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="size-6"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a.75.75 0 0 1-.974-.94 4.542 4.542 0 0 0 .584-2.02A7.838 7.838 0 0 1 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      เชื่อมต่อ LINE Official Account
                    </h2>
                    <p className="text-xs text-slate-500">
                      LINE Messaging API Webhook & Auto-reply
                    </p>
                  </div>
                </div>
                <span
                  id="line-status-badge"
                  className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                >
                  ยังไม่ได้ตั้งค่า
                </span>
              </div>

              <div className="mt-6 space-y-6">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                    Webhook URL (นำไปใส่ใน LINE Developers Console)
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="line-webhook-url"
                      type="text"
                      readOnly={true}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none"
                      placeholder="กำลังโหลด Webhook URL..."
                    />
                    <button
                      id="copy-webhook-btn"
                      type="button"
                      className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      คัดลอก
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-400 leading-5">
                    นำ URL นี้ไปใส่ที่ LINE Developers Console &gt; Messaging
                    API &gt; Webhook settings และเปิด "Use webhook"
                  </p>
                </div>

                <form id="line-settings-form" className="space-y-4">
                  <div>
                    <label
                      htmlFor="line-channel-id"
                      className="mb-1.5 block text-xs font-semibold text-slate-700"
                    >
                      Channel ID (ทางเลือก)
                    </label>
                    <input
                      id="line-channel-id"
                      name="channel_id"
                      type="text"
                      placeholder="เช่น 2001234567"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="line-channel-secret"
                      className="mb-1.5 block text-xs font-semibold text-slate-700"
                    >
                      Channel Secret <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="line-channel-secret"
                      name="channel_secret"
                      type="password"
                      placeholder="Channel Secret จาก LINE Developers Console"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="line-channel-token"
                      className="mb-1.5 block text-xs font-semibold text-slate-700"
                    >
                      Channel Access Token (Long-lived){" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="line-channel-token"
                      name="channel_access_token"
                      rows="3"
                      placeholder="Channel Access Token (long-lived) จาก LINE Developers Console"
                      className="w-full resize-y rounded-xl border border-slate-200 px-4 py-2.5 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    ></textarea>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      id="save-line-btn"
                      type="submit"
                      className="app-primary-button rounded-xl px-6 py-2.5 text-sm font-semibold"
                    >
                      บันทึกการเชื่อมต่อ LINE
                    </button>
                  </div>
                </form>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">ตรวจสอบการเชื่อมต่อจริง</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        ตรวจ Channel Access Token และให้ LINE ทดสอบส่ง webhook มาที่ URL ของร้าน
                      </p>
                    </div>
                    <button id="verify-line-btn" type="button" disabled
                      className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-50">
                      ตรวจสอบกับ LINE
                    </button>
                  </div>
                  <p id="line-verification-detail" role="status" aria-live="polite" className="mt-3 text-xs leading-5 text-slate-600">
                    บันทึกข้อมูลก่อน แล้วกดตรวจสอบกับ LINE
                  </p>
                </div>

                <LineSimulator />
              </div>
            </section>
  );
}
