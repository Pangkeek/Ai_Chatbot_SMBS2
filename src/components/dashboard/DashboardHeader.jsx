import Link from 'next/link';
import BrandMark from './BrandMark.jsx';

export default function DashboardHeader() {
  return (
    <header className="app-dashboard-header sticky top-0 z-30 border-b border-white/20 text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
        <BrandMark />

        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/home" className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-blue-50 transition hover:bg-white/10 sm:inline-flex">
            หน้าแรก
          </Link>
          <div className="hidden border-l border-white/25 pl-4 text-right md:block">
            <p id="header-user-name" className="text-sm font-semibold text-white"></p>
            <p id="header-user-email" className="text-xs text-blue-100"></p>
          </div>
          <button id="logout-button" type="button" className="rounded-xl border border-white/35 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            ออกจากระบบ
          </button>
        </div>
      </div>
    </header>
  );
}
