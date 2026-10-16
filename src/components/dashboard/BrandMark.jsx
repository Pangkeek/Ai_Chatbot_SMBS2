import Link from 'next/link';

// ใช้โลโก้เดียวกันทั้งหน้าเข้าสู่ระบบและแดชบอร์ด
export default function BrandMark() {
  return (
    <Link href="/home" aria-label="SMB Chatbot หน้าแรก" className="inline-flex min-w-0 items-center gap-3 rounded-lg text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#4564c9] shadow-sm">
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
  );
}
