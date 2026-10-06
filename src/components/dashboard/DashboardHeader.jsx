export default function DashboardHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-xl text-white shadow-lg shadow-blue-600/20">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="size-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7.5 18.75a8.25 8.25 0 1 1 3.49 1.77L6 20.25l1.5-1.5Z"
                  />
                  <path
                    strokeLinecap="round"
                    d="M8.75 12h.01M12 12h.01M15.25 12h.01"
                  />
                </svg>
              </div>

              <div>
                <p className="font-bold text-slate-900">SMB Chatbot</p>
                <p className="text-xs text-slate-500">Business dashboard</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p
                  id="header-user-name"
                  className="text-sm font-semibold text-slate-800"
                ></p>

                <p
                  id="header-user-email"
                  className="text-xs text-slate-500"
                ></p>
              </div>

              <button
                id="logout-button"
                type="button"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
        </header>
  );
}
