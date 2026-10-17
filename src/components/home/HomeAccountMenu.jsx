import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useHomeAccount } from './HomeAccountProvider.jsx';

export default function HomeAccountMenu() {
  const { account, signOut } = useHomeAccount();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = event => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = event => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut();
    } finally {
      setOpen(false);
      setLoggingOut(false);
    }
  }

  if (account.status === 'checking') {
    return <div role="status" aria-label="กำลังตรวจสอบบัญชี" className="flex min-h-12 w-12 shrink-0 items-center justify-center"><span className="size-10 animate-pulse rounded-full bg-white/20" /></div>;
  }

  if (account.status === 'guest') {
    return (
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <Link href="/app" className="hidden min-h-12 items-center rounded-xl px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white sm:inline-flex">
          เข้าสู่ระบบ
        </Link>
        <Link href="/app" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#3855b8] shadow-sm transition hover:bg-[#eaf2ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:px-5">
          จัดการร้านค้า <span aria-hidden="true">↗</span>
        </Link>
      </div>
    );
  }

  const name = account.user?.name || 'บัญชีของคุณ';
  const initial = account.user?.name?.trim() ? Array.from(account.user.name.trim())[0].toLocaleUpperCase('th') : '?';

  return (
    <div ref={containerRef} className="relative shrink-0" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <button
        ref={buttonRef}
        id="home-account-button"
        type="button"
        aria-label={`เมนูบัญชี ${name}`}
        aria-expanded={open}
        aria-controls="home-account-dropdown"
        onClick={() => setOpen(!open)}
        className="flex min-h-12 cursor-pointer items-center gap-2 rounded-full border border-white/25 bg-white/10 p-1 pr-3 transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#a4f0e4] text-lg font-bold text-[#18345c]">{initial}</span>
        <span className="hidden max-w-32 truncate text-sm font-semibold sm:block">{name}</span>
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}><path strokeLinecap="round" strokeLinejoin="round" d="m5 7.5 5 5 5-5" /></svg>
      </button>

      {open && (
        <div id="home-account-dropdown" aria-labelledby="home-account-button" className="absolute right-0 top-full z-40 mt-3 w-72 max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white text-[#18345c] shadow-[0_18px_50px_-16px_rgba(15,32,88,.4)]">
          <div className="border-b border-slate-100 px-4 py-4">
            <p className="text-xs font-medium text-[#4564c9]">เข้าสู่ระบบแล้ว</p>
            <p className="mt-1 break-words text-sm font-bold">{name}</p>
            {account.user?.email && <p className="mt-1 break-words text-xs text-slate-500">{account.user.email}</p>}
            {account.error && <p role="status" className="mt-2 text-xs leading-5 text-amber-700">{account.error}</p>}
          </div>
          <div className="space-y-1 p-2">
            <Link href="/app" onClick={() => setOpen(false)} className="flex min-h-12 items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition hover:bg-[#eef3ff] focus-visible:outline-2 focus-visible:outline-[#4564c9]">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 10h16l-2-6H6l-2 6Zm2 0v10h12V10M10 20v-6h4v6" /></svg>
              จัดการร้าน
            </Link>
            <button id="home-logout-button" type="button" disabled={loggingOut} onClick={logout} className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-500 disabled:cursor-wait disabled:opacity-60">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 4H4v16h5m5-13 5 5-5 5m-6-5h11" /></svg>
              {loggingOut ? 'กำลังออกจากระบบ...' : 'ออกจากระบบ'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
