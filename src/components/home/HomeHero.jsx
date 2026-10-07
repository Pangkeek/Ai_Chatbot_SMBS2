import Link from 'next/link';

function ChatPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[560px]" aria-label="ตัวอย่างหน้าจอการตอบคำถามจากคลังความรู้">
      <div className="absolute -left-5 -top-5 size-32 rounded-full bg-cyan-300/35 blur-3xl" aria-hidden="true" />
      <div className="absolute -bottom-7 -right-5 size-36 rounded-full bg-blue-500/25 blur-3xl" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-[28px] border border-white/90 bg-white shadow-[0_32px_90px_-25px_rgba(22,55,105,.3)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#e9f4ff] text-blue-700">✦</span>
            <div><p className="text-sm font-bold text-slate-900">บ้านกาแฟ</p><p className="text-xs text-slate-500">ตัวอย่างบทสนทนา</p></div>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">● พร้อมตอบ</span>
        </div>
        <div className="space-y-5 bg-[radial-gradient(circle_at_15%_20%,#eff7ff,transparent_42%),radial-gradient(circle_at_90%_90%,#f0f8ff,transparent_38%)] px-5 py-7 sm:px-7">
          <div className="ml-auto max-w-[80%] rounded-[20px] rounded-br-md bg-blue-600 px-5 py-4 text-sm leading-7 text-white shadow-lg shadow-blue-600/15">ลาเต้เย็นราคาเท่าไหร่คะ?</div>
          <div className="flex items-end gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">✦</span>
            <div className="max-w-[85%] rounded-[20px] rounded-bl-md border border-slate-100 bg-white px-5 py-4 text-sm leading-7 text-slate-700 shadow-sm">ลาเต้เย็นราคา 75 บาทค่ะ หากต้องการสอบถามเมนูอื่นเพิ่มเติม แจ้งได้เลยนะคะ</div>
          </div>
          <div className="flex items-center gap-2 pl-12 text-xs font-medium text-slate-500"><span className="size-1.5 rounded-full bg-blue-500" /> อ้างอิงจากข้อมูลร้าน</div>
        </div>
        <div className="border-t border-slate-100 px-5 py-4"><div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400"><span>ถามเกี่ยวกับร้านของคุณ...</span><span className="font-semibold text-blue-600">↗</span></div></div>
      </div>
      <div className="absolute -bottom-5 -left-3 hidden items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-xl shadow-blue-950/10 sm:flex">
        <span className="flex size-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">✓</span>
        <span className="text-xs font-semibold text-slate-700">ข้อมูลแต่ละร้านแยกจากกัน</span>
      </div>
    </div>
  );
}

export default function HomeHero() {
  return (
    <section className="relative overflow-hidden bg-[linear-gradient(130deg,#f8fbff_0%,#edf5ff_55%,#f6fcff_100%)]">
      <div className="pointer-events-none absolute -right-28 top-0 size-96 rounded-full border-[55px] border-white/40" aria-hidden="true" />
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[1fr_1fr] lg:gap-16 lg:pb-28 lg:pt-24">
        <div className="relative z-10">
          <p className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-4 py-2 text-xs font-semibold text-blue-700 shadow-sm"><span className="size-2 rounded-full bg-blue-500" /> แพลตฟอร์ม Chatbot สำหรับธุรกิจขนาดเล็ก</p>
          <h1 className="mt-7 max-w-2xl text-[clamp(2.6rem,5vw,4.7rem)] font-bold leading-[1.13] tracking-tight text-slate-900">ตอบลูกค้าได้ไว<br /><span className="text-blue-600">จัดการร้านได้ง่าย</span><br />ในที่เดียว</h1>
          <p className="mt-7 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">รวมข้อมูลร้าน คำถามที่พบบ่อย และการเชื่อมต่อ LINE ไว้ในระบบเดียว เพื่อให้ร้านของคุณดูแลบทสนทนาได้เป็นระเบียบยิ่งขึ้น</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/app" className="inline-flex min-h-13 items-center justify-center gap-3 rounded-2xl bg-blue-600 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">เข้าสู่ระบบ / เริ่มใช้งาน <span aria-hidden="true">→</span></Link>
            <a href="#features" className="inline-flex min-h-13 items-center justify-center rounded-2xl border border-blue-100 bg-white px-7 py-3 text-sm font-bold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">ดูฟีเจอร์ทั้งหมด</a>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-xs font-medium text-slate-500"><span>✓ แยกข้อมูลแต่ละร้าน</span><span>✓ จัดการ FAQ</span><span>✓ ทดลองตอบผ่าน LINE Simulator</span></div>
        </div>
        <ChatPreview />
      </div>
    </section>
  );
}
