import Link from 'next/link';

const steps = [
  { number: '1', title: 'สมัครหรือเข้าสู่ระบบ', detail: 'ใช้บัญชีของคุณเพื่อเข้าถึงเฉพาะร้านที่ได้รับสิทธิ์' },
  { number: '2', title: 'สร้างและตั้งค่าร้าน', detail: 'เพิ่มรายละเอียดร้าน เวลาเปิด และข้อมูลที่ช่วยให้ระบบเข้าใจธุรกิจ' },
  { number: '3', title: 'เติมความรู้และเชื่อม LINE', detail: 'จัด FAQ ให้พร้อม แล้วทดลองคำตอบก่อนเปิดใช้กับลูกค้า' },
];

const pages = [
  { title: 'แดชบอร์ดร้านค้า', path: '/app', description: 'ดูร้านทั้งหมด สร้างร้านใหม่ และเลือกหน้าจัดการของแต่ละร้าน', icon: '▣' },
  { title: 'ข้อมูลธุรกิจ', path: '/app/shops/:shopId/settings', description: 'แก้ไขชื่อ คำอธิบาย เวลาเปิด และบุคลิกการตอบของร้าน', icon: '⌘' },
  { title: 'FAQ และคลังความรู้', path: '/app/shops/:shopId/knowledge', description: 'ดูแลเนื้อหาอ้างอิงที่ใช้ตอบคำถามของลูกค้า', icon: '≡' },
  { title: 'การเชื่อมต่อ LINE', path: '/app/shops/:shopId/line', description: 'ตั้งค่า LINE Official Account และทดลองแชตด้วย Simulator', icon: '↗' },
  { title: 'API Console', path: '/docs', description: 'สำรวจและทดลองคำขอ API ของระบบ', icon: '{ }' },
];

export default function HomeJourney() {
  return (
    <>
      <section id="workflow" aria-labelledby="workflow-title" className="scroll-mt-24 bg-[#f7f9fc] py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[.75fr_1.25fr] lg:items-center">
            <div><p className="text-xs font-bold tracking-[.18em] text-blue-600 uppercase">Getting started</p><h2 id="workflow-title" className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">เริ่มใช้งานได้<br />ใน 3 ขั้นตอน</h2><p className="mt-5 max-w-md text-base leading-8 text-slate-600">จากร้านแรกจนถึงการทดสอบคำตอบ คุณจัดการทุกอย่างจากบัญชีเดียวได้</p><Link href="/app" className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-blue-700 underline decoration-blue-300 underline-offset-4 hover:text-blue-900">ไปที่แดชบอร์ด <span aria-hidden="true">→</span></Link></div>
            <ol className="grid gap-4">
              {steps.map((step) => <li key={step.number} className="flex gap-5 rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-lg font-bold text-white">{step.number}</span><div><h3 className="text-base font-bold text-slate-900">{step.title}</h3><p className="mt-1 text-sm leading-7 text-slate-600">{step.detail}</p></div></li>)}
            </ol>
          </div>
        </div>
      </section>

      <section id="explore" aria-labelledby="explore-title" className="scroll-mt-24 bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="text-xs font-bold tracking-[.18em] text-blue-600 uppercase">Explore the platform</p><h2 id="explore-title" className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">สำรวจหน้าต่าง ๆ ของระบบ</h2><p className="mt-4 text-base leading-8 text-slate-600">หน้าจัดการร้านต้องเข้าสู่ระบบก่อน ส่วน API Console เปิดดูได้จากลิงก์ด้านล่าง</p></div></div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pages.map((page) => <article key={page.title} className="rounded-[22px] border border-slate-200 bg-white p-6 transition hover:border-blue-200 hover:bg-blue-50/30"><span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-lg font-bold text-blue-700" aria-hidden="true">{page.icon}</span><h3 className="mt-5 text-lg font-bold text-slate-900">{page.title}</h3><p className="mt-2 min-h-14 text-sm leading-7 text-slate-600">{page.description}</p><p className="mt-4 break-all font-mono text-xs text-slate-400">{page.path}</p><Link href={page.path === '/docs' ? '/docs' : '/app'} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-blue-700 hover:text-blue-900">{page.path === '/docs' ? 'เปิด API Console' : 'เข้าสู่ระบบเพื่อใช้งาน'} <span aria-hidden="true">→</span></Link></article>)}
          </div>
        </div>
      </section>
    </>
  );
}
