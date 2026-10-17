export default function KnowledgeDeleteModal() {
  return (
    <div
        id="knowledge-delete-modal"
        className="fixed inset-0 z-[70] hidden items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="knowledge-delete-title"
        aria-describedby="knowledge-delete-description"
      >
        <div className="outlined-panel w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-7">
          <div className="flex size-12 items-center justify-center rounded-full bg-red-50 text-xl text-red-600" aria-hidden="true">!</div>
          <h2 id="knowledge-delete-title" className="mt-5 text-xl font-bold text-slate-900">ลบข้อมูลความรู้นี้?</h2>
          <p id="knowledge-delete-description" className="mt-2 text-sm leading-6 text-slate-500"></p>
          <div id="knowledge-delete-error" className="mt-4 hidden rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert"></div>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button id="knowledge-delete-cancel" type="button" className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">ยกเลิก</button>
            <button id="knowledge-delete-confirm" type="button" className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">ลบถาวร</button>
          </div>
        </div>
      </div>
  );
}
