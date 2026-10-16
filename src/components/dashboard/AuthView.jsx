import Link from 'next/link';
import BrandMark from './BrandMark.jsx';
import LoginForm from './LoginForm.jsx';
import RegisterForm from './RegisterForm.jsx';

const highlights = ['ข้อมูลร้านแยกเป็นสัดส่วน', 'FAQ และคลังความรู้', 'เชื่อมต่อ LINE'];

export default function AuthView() {
  return (
    <main id="auth-view" className="app-auth-shell min-h-screen text-white">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <header className="flex items-center justify-between gap-4 border-b border-white/20 py-4">
          <BrandMark />
          <Link href="/home" className="rounded-xl border border-white/35 px-4 py-2 text-sm font-semibold transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            กลับหน้าแรก ↗
          </Link>
        </header>

        <div className="grid items-center gap-10 py-12 lg:min-h-[calc(100vh-78px)] lg:grid-cols-[minmax(0,1fr)_minmax(390px,470px)] lg:gap-16 lg:py-16">
          <section className="relative max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-xs font-semibold tracking-wide text-blue-50">
              <span aria-hidden="true" className="size-2 rounded-full bg-[#79e5ca]" />
              AI CHATBOT · สำหรับธุรกิจ SMBs
            </p>
            <h1 className="mt-7 text-[clamp(2.6rem,5vw,4.7rem)] font-bold leading-[1.16] tracking-tight">
              จัดการร้านของคุณ
              <br />
              <span className="text-[#a4f0e4]">ให้ตอบแชตได้ไวขึ้น</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-blue-50 sm:text-lg">
              ดูแลข้อมูลร้าน คำถามที่พบบ่อย และการเชื่อมต่อ LINE ในที่เดียว
              เพื่อให้ทุกคำตอบอ้างอิงจากข้อมูลของร้านคุณ
            </p>
            <ul className="mt-9 flex flex-wrap gap-2.5" aria-label="จุดเด่นของระบบ">
              {highlights.map((item) => (
                <li key={item} className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-blue-50">
                  ✓ {item}
                </li>
              ))}
            </ul>
          </section>

          <section className="app-auth-card rounded-[30px] bg-white p-6 text-[#18345c] sm:p-9" aria-labelledby="auth-title">
            <p className="text-sm font-semibold text-[#4564c9]">ยินดีต้อนรับ</p>
            <h2 id="auth-title" className="mt-2 text-3xl font-bold tracking-tight">เริ่มต้นใช้งานระบบ</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">เข้าสู่ระบบด้วยบัญชีเดิม หรือสมัครสมาชิกใหม่</p>

            <div className="mt-8 grid grid-cols-2 rounded-xl bg-[#eef3ff] p-1">
              <button id="login-tab" type="button" className="app-auth-tab app-auth-tab--active">
                เข้าสู่ระบบ
              </button>
              <button id="register-tab" type="button" className="app-auth-tab">
                สมัครสมาชิก
              </button>
            </div>

            <LoginForm />
            <RegisterForm />
          </section>
        </div>
      </div>
    </main>
  );
}
