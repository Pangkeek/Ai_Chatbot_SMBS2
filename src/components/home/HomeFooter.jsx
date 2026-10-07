import Link from 'next/link';

export default function HomeFooter() {
  return (
    <>
      <section className="bg-[#0c1d3d] px-5 py-16 text-white sm:px-8 sm:py-20" aria-labelledby="start-title">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div><p className="text-xs font-bold tracking-[.18em] text-cyan-300 uppercase">Ready to begin?</p><h2 id="start-title" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">พร้อมดูแลแชตของร้านให้เป็นระบบแล้วหรือยัง?</h2><p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">เข้าสู่ระบบเพื่อจัดการร้านเดิม หรือสร้างบัญชีเพื่อเริ่มต้นร้านแรกของคุณ</p></div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row"><Link href="/app" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-bold text-blue-800 transition hover:bg-blue-50">เข้าสู่ระบบ</Link><Link href="/app?mode=register" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/30 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10">สมัครสมาชิก</Link></div>
        </div>
      </section>
      <footer className="bg-[#09162f] px-5 py-8 text-slate-400 sm:px-8"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 text-xs sm:flex-row sm:items-center"><p>© {new Date().getFullYear()} SMB Chatbot · ระบบจัดการร้านและข้อมูลแชต</p><nav aria-label="ลิงก์ส่วนท้าย" className="flex flex-wrap gap-5"><Link href="/home" className="hover:text-white">หน้าแรก</Link><Link href="/app" className="hover:text-white">จัดการร้านค้า</Link><Link href="/docs" className="hover:text-white">API Console</Link></nav></div></footer>
    </>
  );
}
