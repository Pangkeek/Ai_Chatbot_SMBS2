import Link from 'next/link';

export default function HomeHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link href="/home" className="inline-flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600" aria-label="SMB Chatbot หน้าแรก">
          <span className="flex size-10 items-center justify-center rounded-[14px] bg-blue-600 text-white shadow-md shadow-blue-600/20">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 11.5a8 8 0 0 1-8 8 8.7 8.7 0 0 1-3.1-.56L4 20l1.06-4.9A8.7 8.7 0 0 1 4.5 12a8 8 0 0 1 8-8 7.5 7.5 0 0 1 7.5 7.5Z" />
              <path strokeLinecap="round" d="M8.5 12h7M8.5 9h4" />
            </svg>
          </span>
          <span className="leading-tight"><strong className="block text-[15px] font-bold tracking-tight text-slate-900">SMB Chatbot</strong><span className="block text-[10px] font-semibold tracking-[.12em] text-blue-600 uppercase">for growing businesses</span></span>
        </Link>

        <nav aria-label="เมนูหน้าแรก" className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          <a href="#features" className="transition hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">ฟีเจอร์</a>
          <a href="#workflow" className="transition hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">เริ่มต้นใช้งาน</a>
          <a href="#explore" className="transition hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">หน้าต่าง ๆ</a>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/app" className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600 sm:inline-flex">เข้าสู่ระบบ</Link>
          <Link href="/app" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:px-5">จัดการร้านค้า <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
    </header>
  );
}
