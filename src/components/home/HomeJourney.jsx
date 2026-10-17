import Link from 'next/link';

const steps = [
  {
    number: '1',
    title: 'สมัครหรือเข้าสู่ระบบ',
    detail: 'ใช้บัญชีของคุณเพื่อเข้าถึงเฉพาะร้านที่ได้รับสิทธิ์',
    color: 'bg-[#4564c9]',
  },
  {
    number: '2',
    title: 'สร้างและตั้งค่าร้าน',
    detail: 'เพิ่มรายละเอียดร้าน เวลาเปิด และข้อมูลที่ช่วยให้ระบบเข้าใจธุรกิจ',
    color: 'bg-[#ff8842]',
  },
  {
    number: '3',
    title: 'เติมความรู้และเชื่อม LINE',
    detail: 'จัด FAQ ให้พร้อม แล้วทดลองคำตอบก่อนเปิดใช้กับลูกค้า',
    color: 'bg-[#36bcb3]',
  },
];

const pages = [
  { title: 'แดชบอร์ดร้านค้า', path: '/app', description: 'ดูร้านทั้งหมด สร้างร้านใหม่ และเลือกหน้าจัดการของแต่ละร้าน', icon: '▣' },
  { title: 'ข้อมูลธุรกิจ', path: '/app/shops/:shopId/settings', description: 'แก้ไขชื่อ คำอธิบาย เวลาเปิด และบุคลิกการตอบของร้าน', icon: '⌘' },
  { title: 'FAQ และคลังความรู้', path: '/app/shops/:shopId/knowledge', description: 'ดูแลเนื้อหาอ้างอิงที่ใช้ตอบคำถามของลูกค้า', icon: '≡' },
  { title: 'การเชื่อมต่อ LINE', path: '/app/shops/:shopId/line', description: 'ตั้งค่า LINE Official Account และทดลองแชตด้วย Simulator', icon: '↗' },
  { title: 'บทสนทนาและสถิติ', path: '/app/shops/:shopId/conversations', description: 'อ่านประวัติ ดูสถิติ แอดมินรับช่วงตอบ LINE และควบคุมบอทด้วย Pause/Resume', icon: '◌' },
  { title: 'API Console', path: '/docs', description: 'สำรวจและทดลองคำขอ API ของระบบ', icon: '{ }' },
];

export default function HomeJourney() {
  return (
    <>
      <section id="workflow" aria-labelledby="workflow-title" className="scroll-mt-24 bg-[#eaf7f6] py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-bold tracking-[.18em] text-[#108f91] uppercase">HOW IT WORKS</p>
              <h2 id="workflow-title" className="mt-4 text-3xl font-bold tracking-tight text-[#18345c] sm:text-4xl">
                เริ่มใช้งานง่ายใน 3 ขั้นตอน
              </h2>
              <p className="mt-4 max-w-xl text-base leading-8 text-slate-600">
                จากร้านแรกจนถึงการทดสอบคำตอบ คุณจัดการทุกอย่างจากบัญชีเดียวได้
              </p>
            </div>
            <Link href="/app" className="inline-flex w-fit items-center gap-2 rounded-xl border border-[#36bcb3] bg-white px-5 py-3 text-sm font-bold text-[#087f84] transition hover:bg-[#f2fffc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f84]">
              ไปที่แดชบอร์ด <span aria-hidden="true">→</span>
            </Link>
          </div>

          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {steps.map((step) => (
              <li key={step.number} className={`relative overflow-hidden rounded-[26px] p-6 text-white shadow-[0_20px_35px_-25px_rgba(24,52,92,.35)] ${step.color}`}>
                <span aria-hidden="true" className="absolute -right-5 -top-9 text-[10rem] font-bold leading-none text-white/10">{step.number}</span>
                <span className="relative flex size-12 items-center justify-center rounded-2xl bg-white/20 text-2xl font-bold">{step.number}</span>
                <h3 className="relative mt-8 text-xl font-bold">{step.title}</h3>
                <p className="relative mt-3 text-sm leading-7 text-white/90">{step.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="explore" aria-labelledby="explore-title" className="scroll-mt-24 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <p className="text-xs font-bold tracking-[.18em] text-[#4564c9] uppercase">EXPLORE THE PLATFORM</p>
          <h2 id="explore-title" className="mt-4 text-3xl font-bold tracking-tight text-[#18345c] sm:text-4xl">
            หน้าต่าง ๆ ของระบบ
          </h2>
          <p className="mt-4 text-base leading-8 text-slate-600">
            หน้าจัดการร้านต้องเข้าสู่ระบบก่อน ส่วน API Console เปิดดูได้จากลิงก์ด้านล่าง
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pages.map((page, index) => (
              <article key={page.title} className="outlined-panel rounded-[24px] border border-[#dfe8f5] border-t-4 border-t-[#4564c9] bg-white p-6 shadow-[0_14px_30px_-25px_rgba(24,52,92,.35)]">
                <span aria-hidden="true" className={`flex size-11 items-center justify-center rounded-xl text-lg font-bold ${index === 2 ? 'bg-[#fff0e7] text-[#d86828]' : 'bg-[#eaf1ff] text-[#4564c9]'}`}>
                  {page.icon}
                </span>
                <h3 className="mt-5 text-lg font-bold text-[#18345c]">{page.title}</h3>
                <p className="mt-2 min-h-14 text-sm leading-7 text-slate-600">{page.description}</p>
                <p className="mt-4 break-all font-mono text-xs text-slate-400">{page.path}</p>
                <Link href={page.path === '/docs' ? '/docs' : '/app'} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#4564c9] hover:text-[#2946a5]">
                  {page.path === '/docs' ? 'เปิด API Console' : 'เข้าสู่ระบบเพื่อใช้งาน'} <span aria-hidden="true">→</span>
                </Link>
              </article>
            ))}
          </div>

        </div>
      </section>
    </>
  );
}
