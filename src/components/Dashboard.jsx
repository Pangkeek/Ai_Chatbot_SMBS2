import { useDashboardController } from "../hooks/useDashboardController";

const simulatorInput =
  "w-full min-w-0 rounded-[10px] border border-[#dbe3e9] bg-white px-3 py-2.5 text-xs focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-green-300";
const simulatorButton =
  "cursor-pointer disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-green-300";
const presetButton = `${simulatorButton} flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 text-left text-xs font-semibold transition-colors hover:border-green-300 hover:bg-green-50 max-[1150px]:flex-wrap max-[540px]:flex-nowrap`;

export default function AppPage() {
  useDashboardController();

  return (
    <>
      <div
        id="notification"
        className="pointer-events-none fixed top-5 right-5 z-50 hidden w-[calc(100%-2.5rem)] max-w-sm rounded-2xl border bg-white p-4 shadow-xl"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <div
            id="notification-icon"
            className="flex size-9 shrink-0 items-center justify-center rounded-full"
          ></div>

          <div className="min-w-0">
            <p id="notification-title" className="font-semibold"></p>

            <p
              id="notification-message"
              className="mt-1 text-sm leading-6 text-slate-600"
            ></p>
          </div>
        </div>
      </div>

      <main
        id="auth-view"
        className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-900 bg-[linear-gradient(135deg,rgba(15,23,42,0.88),rgba(30,64,175,0.68)),url('/assets/auth/Background_image.jpeg')] bg-cover bg-center px-4 py-10 sm:px-6"
      >
        <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/40 bg-white/95 shadow-2xl shadow-slate-950/40 backdrop-blur lg:grid-cols-[1.05fr_0.95fr]">
          <section className="relative hidden overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 p-12 text-white lg:flex lg:flex-col lg:justify-between">
            <div className="absolute -top-20 -right-20 size-64 rounded-full border border-white/20"></div>

            <div className="absolute -right-5 bottom-28 size-40 rounded-full bg-white/10 blur-xl"></div>

            <div className="relative">
              <div className="mb-10 flex size-14 items-center justify-center rounded-2xl bg-white/15 text-2xl shadow-lg ring-1 ring-white/30 backdrop-blur">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="size-7"
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

              <p className="mb-4 text-sm font-semibold tracking-[0.22em] text-blue-100 uppercase">
                SMB Chatbot
              </p>

              <h1 className="max-w-md text-4xl font-bold leading-tight">
                จัดการแชตของแต่ละร้าน
                <span className="text-cyan-100">อย่างเป็นระบบ</span>
              </h1>

              <p className="mt-6 max-w-md text-base leading-8 text-blue-100">
                บริหารข้อมูลร้าน ความรู้ และบทสนทนาในที่เดียว
                พร้อมระบบแยกข้อมูลแต่ละร้านอย่างปลอดภัย
              </p>
            </div>

            <div className="relative grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="size-6 text-cyan-100"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3.75 5.25 6.5v5.08c0 4.46 2.9 7.77 6.75 8.67 3.85-.9 6.75-4.2 6.75-8.67V6.5L12 3.75Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m9.5 12 1.65 1.65L14.75 10"
                  />
                </svg>
                <p className="mt-2 text-sm font-medium">ปลอดภัย</p>
              </div>

              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="size-6 text-cyan-100"
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
                <p className="mt-2 text-sm font-medium">แยกร้าน</p>
              </div>

              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="size-6 text-cyan-100"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m12 3 1.25 5.75L19 10l-5.75 1.25L12 17l-1.25-5.75L5 10l5.75-1.25L12 3Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m18.5 15 .5 2.5 2.5.5-2.5.5-.5 2.5-.5-2.5-2.5-.5 2.5-.5.5-2.5Z"
                  />
                </svg>
                <p className="mt-2 text-sm font-medium">ใช้ง่าย</p>
              </div>
            </div>
          </section>

          <section className="p-6 sm:p-10 lg:p-12">
            <div className="mb-8 lg:hidden">
              <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-blue-600 text-xl text-white shadow-lg shadow-blue-600/20">
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

              <h1 className="text-2xl font-bold">SMB Chatbot</h1>
              <p className="mt-1 text-sm text-slate-500">
                ระบบจัดการ Chatbot สำหรับธุรกิจของคุณ
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold text-blue-600">
                ยินดีต้อนรับ
              </p>

              <h2 className="mt-2 text-3xl font-bold tracking-tight">
                เริ่มต้นใช้งานระบบ
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-500">
                เข้าสู่ระบบด้วยบัญชีเดิม หรือสมัครสมาชิกใหม่
              </p>
            </div>

            <div className="mt-8 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
              <button
                id="login-tab"
                type="button"
                className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition"
              >
                เข้าสู่ระบบ
              </button>

              <button
                id="register-tab"
                type="button"
                className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
              >
                สมัครสมาชิก
              </button>
            </div>

            <form id="login-form" className="mt-8 space-y-5">
              <div>
                <label
                  htmlFor="login-email"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  อีเมล
                </label>

                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  required={true}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  รหัสผ่าน
                </label>

                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="กรอกรหัสผ่าน"
                  minLength="10"
                  maxLength="128"
                  required={true}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:shadow-xl disabled:translate-y-0 disabled:opacity-60"
              >
                เข้าสู่ระบบ
              </button>

              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-xs font-semibold text-blue-800">
                  บัญชีทดลอง
                </p>

                <p className="mt-1 text-xs leading-5 text-blue-700">
                  coffee@example.test
                  <br />
                  DemoPass!2026
                </p>
              </div>
            </form>

            <form id="register-form" className="mt-8 hidden space-y-5">
              <div>
                <label
                  htmlFor="register-name"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  ชื่อผู้ใช้งาน
                </label>

                <input
                  id="register-name"
                  name="name"
                  autoComplete="name"
                  placeholder="เช่น สมชาย ใจดี"
                  maxLength="100"
                  required={true}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="register-email"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  อีเมล
                </label>

                <input
                  id="register-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  maxLength="254"
                  required={true}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="register-password"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  รหัสผ่าน
                </label>

                <input
                  id="register-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="อย่างน้อย 10 ตัวอักษร"
                  minLength="10"
                  maxLength="128"
                  required={true}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />

                <p className="mt-2 text-xs text-slate-400">
                  ใช้อย่างน้อย 10 ตัวอักษร
                </p>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:shadow-xl disabled:translate-y-0 disabled:opacity-60"
              >
                สร้างบัญชี
              </button>
            </form>
          </section>
        </div>
      </main>

      <div id="dashboard-view" className="hidden min-h-screen bg-slate-50">
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

        <main
          id="dashboard-home-view"
          className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
        >
          <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-950 to-blue-800 p-6 text-white shadow-xl sm:p-8">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
              <div>
                <p className="text-sm font-medium text-blue-200">ภาพรวมบัญชี</p>

                <h1 className="mt-2 text-3xl font-bold">
                  <span className="inline-flex items-center gap-2">
                    สวัสดี <span id="welcome-name"></span>
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="size-6 text-cyan-200"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m12 3 1.25 5.75L19 10l-5.75 1.25L12 17l-1.25-5.75L5 10l5.75-1.25L12 3Z"
                      />
                    </svg>
                  </span>
                </h1>

                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
                  เลือกร้านที่ต้องการจัดการ หรือสร้างร้านใหม่เพื่อเริ่มต้นใช้งาน
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 px-6 py-4 backdrop-blur">
                <p className="text-xs text-blue-200">ร้านที่ดูแล</p>

                <p className="mt-1 text-3xl font-bold">
                  <span id="shop-count">0</span>
                  <span className="text-sm font-medium text-blue-200">
                    ร้าน
                  </span>
                </p>
              </div>
            </div>
          </section>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
            <section>
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    ร้านค้าของคุณ
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    ระบบจะแสดงเฉพาะร้านที่บัญชีนี้มีสิทธิ์เข้าถึง
                  </p>
                </div>
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
                  สร้างร้านแรกของคุณจากแบบฟอร์มด้านข้าง
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

            <aside>
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

                <h2 className="mt-5 text-xl font-bold">สร้างร้านใหม่</h2>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  บัญชีของคุณจะเป็นเจ้าของร้านโดยอัตโนมัติ
                </p>

                <form id="shop-form" className="mt-6 space-y-5">
                  <div>
                    <label
                      htmlFor="shop-name"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      ชื่อร้าน
                    </label>

                    <input
                      id="shop-name"
                      name="name"
                      placeholder="เช่น บ้านกาแฟ"
                      maxLength="120"
                      required={true}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="shop-description"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      รายละเอียดร้าน
                    </label>

                    <textarea
                      id="shop-description"
                      name="description"
                      rows="3"
                      placeholder="อธิบายเกี่ยวกับร้านแบบสั้น ๆ"
                      maxLength="5000"
                      className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-60"
                  >
                    สร้างร้านค้า
                  </button>
                </form>
              </div>
            </aside>
          </div>
        </main>
      <main
        id="business-settings-view"
        className="mx-auto hidden max-w-5xl px-4 py-8 sm:px-6 lg:px-8"
      >
        <button
          id="settings-back-button"
          type="button"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-blue-600"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="size-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m14.25 18-6-6 6-6"
            />
          </svg>
          กลับไปหน้าร้านค้า
        </button>

        <div className="mt-6">
          <p id="settings-eyebrow" className="text-sm font-semibold text-blue-600">
            Business Settings
          </p>

          <h1 id="settings-title" className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            ตั้งค่าข้อมูลธุรกิจ
          </h1>

          <p id="settings-description-text" className="mt-3 text-sm leading-6 text-slate-500">
            ข้อมูลส่วนนี้จะช่วยให้ Chatbot เข้าใจร้านและตอบลูกค้าได้เหมาะสมขึ้น
          </p>
        </div>

        <nav
          className="mt-7 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm"
          aria-label="เมนูจัดการร้าน"
        >
          <button
            id="settings-business-tab"
            type="button"
            className="shrink-0 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
            aria-controls="business-settings-section"
            aria-selected="true"
          >
            ข้อมูลธุรกิจ
          </button>
          <button
            id="settings-knowledge-tab"
            type="button"
            className="shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
            aria-controls="knowledge-management-section"
            aria-selected="false"
          >
            FAQ และคลังความรู้
          </button>
          <button
            id="settings-line-tab"
            type="button"
            className="shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
            aria-controls="line-integration-section"
            aria-selected="false"
          >
            การเชื่อมต่อ LINE
          </button>
        </nav>

        <div className="mt-6">
          <div className="space-y-8">
            <section id="business-settings-section" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <form id="business-settings-form" className="space-y-6">
                <div>
                  <label
                    htmlFor="settings-name"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    ชื่อธุรกิจ
                    <span className="text-red-500">*</span>
                  </label>

                  <input
                    id="settings-name"
                    name="name"
                    maxLength="120"
                    required={true}
                    placeholder="เช่น บ้านกาแฟ"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="settings-description"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    รายละเอียดธุรกิจ
                  </label>

                  <textarea
                    id="settings-description"
                    name="description"
                    rows="5"
                    maxLength="5000"
                    placeholder="อธิบายว่าร้านขายสินค้าหรือให้บริการอะไร"
                    className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  ></textarea>

                  <p className="mt-2 text-xs text-slate-400">
                    ตัวอย่าง: ร้านกาแฟและเบเกอรี
                    มีบริการนั่งที่ร้านและซื้อกลับบ้าน
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="settings-opening-hours"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    เวลาเปิดให้บริการ
                  </label>

                  <textarea
                    id="settings-opening-hours"
                    name="opening_hours"
                    rows="3"
                    maxLength="1000"
                    placeholder="เช่น จันทร์-อาทิตย์ 08:00-18:00"
                    className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  ></textarea>
                </div>

                <div>
                  <label
                    htmlFor="settings-persona"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    บุคลิกของ Chatbot
                  </label>

                  <textarea
                    id="settings-persona"
                    name="persona"
                    rows="4"
                    maxLength="5000"
                    placeholder="เช่น ตอบสุภาพ กระชับ เป็นกันเอง และไม่เดาข้อมูลที่ไม่มีในระบบ"
                    className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  ></textarea>

                  <p className="mt-2 text-xs text-slate-400">
                    ระบุโทนภาษา วิธีเรียกลูกค้า และสิ่งที่บอทไม่ควรทำ
                  </p>
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <p
                    id="settings-shop-id"
                    className="text-xs text-slate-400"
                  ></p>

                  <button
                    type="submit"
                    className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-60"
                  >
                    บันทึกการตั้งค่า
                  </button>
                </div>
              </form>
            </section>

            <section
              id="knowledge-management-section"
              className="hidden space-y-6"
              aria-labelledby="knowledge-section-title"
            >
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold tracking-[0.16em] text-violet-600 uppercase">
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
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-violet-300 disabled:cursor-not-allowed disabled:opacity-50"
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
                  <div className="rounded-2xl bg-slate-900 p-4 text-white">
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
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="knowledge-kind-filter" className="sr-only">กรองตามประเภท</label>
                    <select
                      id="knowledge-kind-filter"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
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
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
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
                className="hidden rounded-3xl border border-red-200 bg-white px-6 py-10 text-center shadow-sm"
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
                className="hidden rounded-3xl border-2 border-dashed border-slate-200 bg-white px-6 py-12 text-center"
              >
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-violet-50 text-2xl text-violet-600" aria-hidden="true">?</div>
                <h3 id="knowledge-empty-title" className="mt-4 text-lg font-bold text-slate-900">ยังไม่มีข้อมูลความรู้</h3>
                <p id="knowledge-empty-message" className="mt-2 text-sm leading-6 text-slate-500">เพิ่มข้อมูลแรกเพื่อให้ Chatbot เริ่มตอบจากข้อมูลของร้าน</p>
              </div>

              <div id="knowledge-list" className="grid gap-4"></div>

              <footer
                id="knowledge-pagination"
                className="hidden flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <p id="knowledge-results-summary" className="text-xs text-slate-500" aria-live="polite"></p>
                <div className="flex gap-2">
                  <button id="knowledge-prev-button" type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">ก่อนหน้า</button>
                  <span id="knowledge-page-label" className="min-w-20 self-center text-center text-xs font-semibold text-slate-600"></span>
                  <button id="knowledge-next-button" type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">ถัดไป</button>
                </div>
              </footer>
            </section>

            <section
              id="line-integration-section"
              className="hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
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
                      className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-60"
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

                <section
                  className="border-t border-slate-200 pt-7"
                  aria-labelledby="line-sim-title"
                >
                  <div className="mb-[22px] flex items-center justify-between gap-4 max-[540px]:items-start">
                    <div>
                      <p className="text-[10px] font-extrabold tracking-[.16em] text-green-700">
                        CHAT PLAYGROUND
                      </p>
                      <h3
                        id="line-sim-title"
                        className="mt-1 text-2xl font-bold tracking-[-.04em] max-[540px]:text-[21px]"
                      >
                        LINE Simulator
                      </h3>
                      <p className="mt-1 text-[13px] text-slate-500 max-[540px]:text-xs">
                        ลองเป็นลูกค้า แล้วดูว่าบอทของร้านตอบอย่างไร
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-[7px] rounded-full border border-green-200 bg-green-50 px-2.5 py-1.5 text-[11px] text-green-800">
                      <span className="size-1.5 rounded-full bg-green-600" />
                      โหมดทดสอบ
                    </span>
                  </div>
                  <div className="grid grid-cols-1 items-start gap-6 min-[1151px]:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)]">
                    <aside className="min-w-0 pt-1.5">
                      <div className="mb-4 flex items-center gap-2.5 text-[11px] font-bold text-slate-400">
                        01{" "}
                        <span className="text-[13px] text-slate-700">
                          ตั้งค่าผู้ทดสอบ
                        </span>
                      </div>
                      <label
                        htmlFor="line-sim-user"
                        className="mb-[7px] block text-[11px] font-semibold text-slate-600"
                      >
                        รหัสลูกค้า LINE
                      </label>
                      <input
                        id="line-sim-user"
                        className={simulatorInput}
                        type="text"
                        defaultValue="line-user-demo-1"
                        maxLength="100"
                        autoComplete="off"
                      />
                      <p className="mt-2 text-[10px] leading-[1.8] text-slate-500">
                        ใช้รหัสเดิมเพื่อทดสอบบทสนทนาต่อเนื่อง
                        หรือเปลี่ยนรหัสเพื่อจำลองลูกค้าคนอื่น
                      </p>
                      <div className="mb-4 mt-[26px] flex items-center gap-2.5 text-[11px] font-bold text-slate-400">
                        02{" "}
                        <span className="text-[13px] text-slate-700">
                          เลือกคำถามเริ่มต้น
                        </span>
                      </div>
                      <div className="grid gap-[9px] min-[541px]:max-[1150px]:grid-cols-3">
                        <button
                          className={presetButton}
                          type="button"
                          data-sim-prompt="ลาเต้เย็นราคาเท่าไหร่"
                          data-sim-prompt-flower="ช่อกุหลาบราคาเท่าไหร่"
                        >
                          <span
                            className="grid size-[30px] shrink-0 place-items-center rounded-[9px] bg-green-50 text-lg text-green-700"
                            aria-hidden="true"
                          >
                            ✦
                          </span>
                          <span>
                            ค้นข้อมูลสินค้า
                            <small className="mt-[3px] block text-[10px] font-normal text-slate-500">
                              ตัวอย่างค้นความรู้ที่ไม่ใช่ FAQ
                            </small>
                          </span>
                          <span
                            className="ml-auto text-slate-400 max-[1150px]:hidden"
                            aria-hidden="true"
                          >
                            ↗
                          </span>
                        </button>
                        <button
                          className={presetButton}
                          type="button"
                          data-sim-prompt="ร้านเปิดปิดกี่โมงครับ"
                        >
                          <span
                            className="grid size-[30px] shrink-0 place-items-center rounded-[9px] bg-green-50 text-lg text-green-700"
                            aria-hidden="true"
                          >
                            ◷
                          </span>
                          <span>
                            เวลาเปิดทำการ
                            <small className="mt-[3px] block text-[10px] font-normal text-slate-500">
                              เช็กข้อมูลพื้นฐานของร้าน
                            </small>
                          </span>
                          <span
                            className="ml-auto text-slate-400 max-[1150px]:hidden"
                            aria-hidden="true"
                          >
                            ↗
                          </span>
                        </button>
                        <button
                          className={presetButton}
                          type="button"
                          data-sim-prompt="ขอคุยกับเจ้าหน้าที่ได้ไหมครับ"
                        >
                          <span
                            className="grid size-[30px] shrink-0 place-items-center rounded-[9px] bg-green-50 text-lg text-green-700"
                            aria-hidden="true"
                          >
                            ☏
                          </span>
                          <span>
                            ติดต่อเจ้าหน้าที่
                            <small className="mt-[3px] block text-[10px] font-normal text-slate-500">
                              ลองทดสอบการส่งต่อแชต
                            </small>
                          </span>
                          <span
                            className="ml-auto text-slate-400 max-[1150px]:hidden"
                            aria-hidden="true"
                          >
                            ↗
                          </span>
                        </button>
                      </div>
                      <div className="mt-[22px] rounded-xl bg-slate-50 p-[14px] text-[11px] leading-[1.8] text-slate-500 max-[1150px]:mt-[14px]">
                        <strong className="text-slate-600">
                          พื้นที่ทดลองของร้านคุณ
                        </strong>
                        <p className="mt-1">
                          ข้อความจะถูกบันทึกในระบบ แต่จะไม่ส่งไปยัง LINE
                          ของลูกค้าจริง
                        </p>
                      </div>
                    </aside>
                    <div className="min-w-0 overflow-hidden rounded-[20px] border border-[#dbe3e9] shadow-[0_12px_32px_-20px_#33415570]">
                      <header className="flex items-center gap-2.5 bg-white p-4">
                        <span
                          className="grid size-[38px] shrink-0 place-items-center rounded-[13px] bg-[#06c755] text-2xl text-white"
                          aria-hidden="true"
                        >
                          ✦
                        </span>
                        <div className="min-w-0">
                          <strong
                            id="line-sim-shop-name"
                            className="block text-[13px] [overflow-wrap:anywhere]"
                          >
                            บอทร้านค้า
                          </strong>
                          <p className="mt-[3px] text-[10px] text-slate-500">
                            ตัวอย่างบทสนทนา · LINE OA
                          </p>
                        </div>
                        <span className="ml-auto text-[8px] tracking-[.1em] text-slate-500 max-[540px]:hidden">
                          PREVIEW
                        </span>
                      </header>
                      <div
                        id="line-sim-result"
                        className="h-[340px] overflow-y-auto overscroll-contain bg-[#e8f0ee] bg-[radial-gradient(#cadbd5_0.7px,transparent_0.7px)] bg-[length:16px_16px] px-4 py-5 max-[540px]:h-[310px]"
                        role="log"
                        aria-label="บทสนทนาทดสอบ"
                        aria-live="polite"
                        aria-relevant="additions text"
                      >
                        <div className="sim-empty flex h-full flex-col items-center justify-center gap-3 text-center text-[#334f46]">
                          <span
                            className="grid h-14 w-[62px] place-items-center rounded-[20px_20px_20px_5px] bg-white text-[25px] tracking-[3px] text-[#06a847] shadow-[0_6px_20px_#1665340d]"
                            aria-hidden="true"
                          >
                            •••
                          </span>
                          <strong className="text-[15px]">
                            บทสนทนาดี ๆ เริ่มตรงนี้
                          </strong>
                          <p className="text-[11px] leading-[1.9] text-[#5a756c]">
                            เลือกคำถามตัวอย่าง หรือพิมพ์ข้อความด้านล่าง
                            <br />
                            เพื่อเริ่มทดสอบบอทของคุณ
                          </p>
                          <span className="rounded-full bg-white/65 px-3 py-1.5 text-[9px]">
                            ลูกค้าถาม → บอทตอบ → ดูผลลัพธ์
                          </span>
                        </div>
                      </div>
                      <form
                        id="line-sim-form"
                        className="bg-white px-4 pb-2.5 pt-[14px]"
                      >
                        <label
                          htmlFor="line-sim-text"
                          className="mb-[7px] block text-[11px] font-semibold text-slate-600"
                        >
                          ข้อความจากลูกค้า
                        </label>
                        <div className="flex gap-2 max-[540px]:flex-wrap">
                          <input
                            id="line-sim-text"
                            className={`${simulatorInput} max-[540px]:flex-[1_1_150px]`}
                            type="text"
                            placeholder="พิมพ์ข้อความที่อยากลองถาม…"
                            maxLength="10000"
                            required={true}
                            autoComplete="off"
                          />
                          <button
                            id="line-sim-btn"
                            className={`${simulatorButton} shrink-0 rounded-[10px] bg-[#087f3c] px-3 py-2.5 text-[11px] font-semibold text-white hover:bg-[#06652f] max-[540px]:flex-[1_0_auto]`}
                            type="submit"
                          >
                            ส่งข้อความ ↗
                          </button>
                        </div>
                        <p className="mt-2 text-[10px] leading-[1.8] text-slate-500">
                          กด Enter เพื่อส่งข้อความ
                        </p>
                      </form>
                      <footer className="flex items-center justify-between gap-3 border-t border-[#eef2f6] bg-slate-50 px-4 py-2.5 text-[10px] text-slate-500">
                        <span id="line-sim-status" role="status">
                          พร้อมทดสอบ
                        </span>
                        <button
                          id="line-sim-clear"
                          className={`${simulatorButton} shrink-0 underline underline-offset-[3px]`}
                          type="button"
                          title="ล้างเฉพาะข้อความที่แสดง ไม่ลบประวัติในระบบ"
                        >
                          ล้างหน้าจอ
                        </button>
                      </footer>
                    </div>
                  </div>
                </section>
              </div>
            </section>
          </div>
        </div>
      </main>
      </div>

      <div
        id="knowledge-modal"
        className="fixed inset-0 z-[60] hidden items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="knowledge-modal-title"
      >
        <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
          <div className="flex items-start justify-between border-b border-slate-100 px-5 py-5 sm:px-7">
            <div>
              <p className="text-xs font-bold tracking-[0.16em] text-violet-600 uppercase">Knowledge editor</p>
              <h2 id="knowledge-modal-title" className="mt-1 text-xl font-bold text-slate-900">เพิ่มข้อมูลความรู้</h2>
            </div>
            <button
              id="knowledge-modal-close"
              type="button"
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-3 focus-visible:outline-violet-300"
              aria-label="ปิดหน้าต่าง"
            >
              ✕
            </button>
          </div>

          <form id="knowledge-form" className="space-y-5 p-5 sm:p-7" noValidate={true}>
            <div>
              <label htmlFor="knowledge-kind" className="mb-2 block text-sm font-semibold text-slate-700">ประเภทข้อมูล</label>
              <select id="knowledge-kind" name="kind" required={true} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100">
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
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
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
                className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm leading-7 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                placeholder="เขียนคำตอบที่ชัดเจนและพร้อมให้ Chatbot นำไปใช้"
              ></textarea>
              <p id="knowledge-content-error" className="mt-2 hidden text-xs font-medium text-red-600"></p>
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-slate-700">สถานะ</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 transition has-[:checked]:border-violet-400 has-[:checked]:bg-violet-50">
                  <input type="radio" name="status" value="draft" defaultChecked={true} className="mt-1 accent-violet-600" />
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
              <button id="knowledge-form-submit" type="submit" className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50">บันทึกข้อมูล</button>
            </div>
          </form>
        </div>
      </div>

      <div
        id="knowledge-delete-modal"
        className="fixed inset-0 z-[70] hidden items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="knowledge-delete-title"
        aria-describedby="knowledge-delete-description"
      >
        <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-7">
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
    </>
  );
}
