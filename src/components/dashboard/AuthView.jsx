import RegisterForm from './RegisterForm.jsx';
import LoginForm from './LoginForm.jsx';
export default function AuthView() {
  return (
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

            <LoginForm />

            <RegisterForm />
          </section>
        </div>
      </main>
  );
}
