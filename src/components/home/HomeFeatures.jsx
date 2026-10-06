const features = [
  {
    number: '01', icon: '▣', tone: 'bg-blue-50 text-blue-700',
    title: 'จัดการหลายร้านในบัญชีเดียว',
    description: 'สร้างร้านและดูรายการร้านที่บัญชีของคุณมีสิทธิ์เข้าถึง พร้อมข้อมูลธุรกิจและเวลาเปิดให้บริการของแต่ละร้าน',
  },
  {
    number: '02', icon: '≡', tone: 'bg-cyan-50 text-cyan-700',
    title: 'จัดระเบียบ FAQ และคลังความรู้',
    description: 'เพิ่ม แก้ไข ค้นหา และกำหนดสถานะเนื้อหาที่ใช้เป็นข้อมูลอ้างอิงสำหรับการตอบคำถามลูกค้า',
  },
  {
    number: '03', icon: '↗', tone: 'bg-emerald-50 text-emerald-700',
    title: 'เชื่อมต่อ LINE Official Account',
    description: 'ตั้งค่า Messaging API และ Webhook ของร้าน แล้วตรวจสถานะการเชื่อมต่อจากหน้าแดชบอร์ด',
  },
  {
    number: '04', icon: '✳', tone: 'bg-violet-50 text-violet-700',
    title: 'ทดลองคำตอบก่อนใช้งาน',
    description: 'ใช้ LINE Simulator ถามคำถามตัวอย่างและตรวจวิธีตอบพร้อมแหล่งข้อมูลที่ระบบนำมาอ้างอิง',
  },
];

export default function HomeFeatures() {
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-24 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-bold tracking-[.18em] text-blue-600 uppercase">What you can do</p>
          <h2 id="features-title" className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">เครื่องมือที่ร้านของคุณต้องใช้<br /><span className="text-blue-600">อยู่ในพื้นที่เดียวกัน</span></h2>
          <p className="mt-5 text-base leading-8 text-slate-600">เริ่มจากข้อมูลร้านที่ถูกต้อง แล้วต่อยอดสู่การตอบคำถามผ่านช่องทางที่ลูกค้าใช้อยู่</p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {features.map((feature) => (
            <article key={feature.number} className="group flex flex-col rounded-[26px] border border-slate-200 bg-white p-6 shadow-[0_12px_34px_-25px_rgba(15,23,42,.3)] transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_22px_44px_-25px_rgba(37,99,235,.35)]">
              <div className="flex items-start justify-between"><span className={`flex size-12 items-center justify-center rounded-2xl text-2xl font-bold ${feature.tone}`} aria-hidden="true">{feature.icon}</span><span className="text-xs font-semibold text-slate-300">{feature.number}</span></div>
              <h3 className="mt-8 text-lg font-bold leading-7 text-slate-900">{feature.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{feature.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
