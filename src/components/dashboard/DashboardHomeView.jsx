import { useEffect, useRef, useState } from 'react';
import CreateShopForm from './CreateShopForm.jsx';
export default function DashboardHomeView() {
  const [createShopOpen, setCreateShopOpen] = useState(false);
  const createButtonRef = useRef(null);
  const shopNameRef = useRef(null);

  useEffect(() => {
    if (createShopOpen) shopNameRef.current?.focus();
  }, [createShopOpen]);

  return (
    <main
          id="dashboard-home-view"
          className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
        >
          <section className="app-dashboard-hero relative overflow-hidden rounded-[30px] p-6 text-white sm:p-8">
            <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-16 size-52 rounded-full border-[34px] border-white/10" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 left-1/3 size-64 rounded-full bg-[#a4f0e4]/10 blur-2xl" />
            <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
              <div>
                <p className="text-sm font-medium text-blue-100">ภาพรวมบัญชี</p>

                <h1 className="mt-2 text-3xl font-bold">
                  <span className="inline-flex items-center gap-2">
                    สวัสดี <span id="welcome-name"></span>
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="size-6 text-[#a4f0e4]"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m12 3 1.25 5.75L19 10l-5.75 1.25L12 17l-1.25-5.75L5 10l5.75-1.25L12 3Z"
                      />
                    </svg>
                  </span>
                </h1>

                <p className="mt-3 max-w-xl text-sm leading-6 text-blue-50">
                  เลือกร้านที่ต้องการจัดการ หรือสร้างร้านใหม่เพื่อเริ่มต้นใช้งาน
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 px-6 py-4 backdrop-blur">
                <p className="text-xs text-blue-100">ร้านที่ดูแล</p>

                <p className="mt-1 text-3xl font-bold">
                  <span id="shop-count">0</span>
                  <span className="text-sm font-medium text-blue-200">
                    ร้าน
                  </span>
                </p>
              </div>
            </div>
          </section>

          <div className={`mt-8 grid gap-8 ${createShopOpen ? 'lg:grid-cols-[minmax(0,1fr)_360px]' : ''}`}>
            <section>
              <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    ร้านค้าของคุณ
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    ระบบจะแสดงเฉพาะร้านที่บัญชีนี้มีสิทธิ์เข้าถึง
                  </p>
                </div>
                <button
                  ref={createButtonRef}
                  id="create-shop-button"
                  type="button"
                  aria-expanded={createShopOpen}
                  aria-controls="create-shop-panel"
                  onClick={() => setCreateShopOpen(true)}
                  className="app-primary-button inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold"
                >
                  <span aria-hidden="true" className="text-xl">+</span> สร้างร้านค้าใหม่
                </button>
              </div>

              <div id="shop-loading" className="grid gap-4 sm:grid-cols-2">
                <div className="h-44 animate-pulse rounded-2xl bg-slate-200"></div>
                <div className="h-44 animate-pulse rounded-2xl bg-slate-200"></div>
              </div>

              <div
                id="empty-shops"
                className="hidden rounded-3xl border-2 border-dashed border-slate-200 bg-white px-6 py-14 text-center"
              >
                <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-blue-50 text-3xl">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    className="size-8 text-blue-600"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 9.25h16.5l-1.25-4.5H5l-1.25 4.5Z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5.25 9.25v9.5h13.5v-9.5M9 18.75V14h6v4.75"
                    />
                  </svg>
                </div>

                <h3 className="mt-5 text-lg font-bold">ยังไม่มีร้านค้า</h3>

                <p className="mt-2 text-sm text-slate-500">
                  กดปุ่ม “+ สร้างร้านค้าใหม่” เพื่อสร้างร้านแรกของคุณ
                </p>
              </div>

              <div id="shop-list" className="grid gap-4 sm:grid-cols-2"></div>

              <section
                id="shop-detail"
                className="mt-8 hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-blue-600 uppercase">
                      ร้านที่เลือก
                    </p>

                    <h3
                      id="selected-shop-name"
                      className="mt-2 text-2xl font-bold"
                    ></h3>
                  </div>

                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    พร้อมใช้งาน
                  </span>
                </div>

                <dl className="mt-6 grid gap-5 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <dt className="text-xs font-semibold text-slate-400">
                      รายละเอียด
                    </dt>

                    <dd
                      id="selected-shop-description"
                      className="mt-2 text-sm leading-6 text-slate-700"
                    ></dd>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-4">
                    <dt className="text-xs font-semibold text-slate-400">
                      เวลาเปิดให้บริการ
                    </dt>

                    <dd
                      id="selected-shop-hours"
                      className="mt-2 text-sm leading-6 text-slate-700"
                    ></dd>
                  </div>
                </dl>
              </section>
            </section>

            {/* คง form ไว้ใน DOM เพื่อให้ controller ผูก submit ได้ตั้งแต่เปิดหน้า */}
            <aside id="create-shop-panel" hidden={!createShopOpen} aria-labelledby="create-shop-title">
              <div className="sticky top-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-2xl">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="size-6 text-blue-600"
                  >
                    <path
                      strokeLinecap="round"
                      d="M12 5.25v13.5M5.25 12h13.5"
                    />
                  </svg>
                </div>

                <h2 id="create-shop-title" className="mt-5 text-xl font-bold">สร้างร้านใหม่</h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  บัญชีของคุณจะเป็นเจ้าของร้านโดยอัตโนมัติ
                </p>

                <CreateShopForm inputRef={shopNameRef} onReset={() => setCreateShopOpen(false)} />
                <button
                  id="close-create-shop-button"
                  type="button"
                  onClick={() => {
                    setCreateShopOpen(false);
                    createButtonRef.current?.focus();
                  }}
                  className="mt-3 min-h-12 w-full cursor-pointer rounded-xl border border-slate-200 px-5 py-3 text-sm text-slate-600 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#4564c9]"
                >
                  ปิดแบบฟอร์ม
                </button>
              </div>
            </aside>
          </div>
        </main>
  );
}
