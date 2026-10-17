import Link from 'next/link';
import HomeAccountMenu from './HomeAccountMenu.jsx';

const navigation = [
  { href: '#features', label: 'ฟีเจอร์' },
  { href: '#workflow', label: 'วิธีเริ่มต้น' },
  { href: '#explore', label: 'หน้าของระบบ' },
];

export default function HomeHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/20 bg-[var(--home-blue)] text-white shadow-[0_8px_24px_-18px_rgba(19,42,102,.8)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
        <Link
          href="/home"
          aria-label="SMB Chatbot หน้าแรก"
          className="inline-flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[13px] bg-white text-[#4564c9] shadow-sm">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="size-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 11.5a8 8 0 0 1-8 8 8.7 8.7 0 0 1-3.1-.56L4 20l1.06-4.9A8.7 8.7 0 0 1 4.5 12a8 8 0 0 1 8-8 7.5 7.5 0 0 1 7.5 7.5Z" />
              <path strokeLinecap="round" d="M8.5 12h7M8.5 9h4" />
            </svg>
          </span>
          <span className="min-w-0 leading-tight">
            <strong className="block truncate text-[15px] font-bold tracking-tight">SMB Chatbot</strong>
            <span className="block text-[10px] font-medium tracking-[.08em] text-blue-100">ผู้ช่วยแชตสำหรับร้านค้า</span>
          </span>
        </Link>

        <nav aria-label="เมนูหน้าแรก" className="hidden items-center gap-7 text-sm font-medium text-blue-50 lg:flex">
          {navigation.map(({ href, label }) => (
            <a key={href} href={href} className="rounded-sm transition hover:text-white hover:underline hover:underline-offset-8 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
              {label}
            </a>
          ))}
        </nav>

        <HomeAccountMenu />
      </div>
    </header>
  );
}
