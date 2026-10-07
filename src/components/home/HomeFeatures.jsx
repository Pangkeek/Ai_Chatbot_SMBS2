import Image from 'next/image';

// ภาพทั้งสามเป็นภาพที่ผู้ใช้ส่งมา ใช้ประกอบฟีเจอร์ที่ตรงกับหน้าจอจริงของระบบ
const features = [
  {
    number: '01',
    label: 'STORE MANAGER',
    title: 'จัดการร้านได้ในที่เดียว',
    description: 'สร้างร้าน ดูร้านที่มีสิทธิ์เข้าถึง และตั้งค่าข้อมูลธุรกิจแยกจากร้านอื่น',
    image: null,
    card: 'bg-[var(--home-teal)] text-white border-[var(--home-teal)]',
    labelColor: 'text-white/75',
    imageBox: 'bg-white/20',
  },
  {
    number: '02',
    label: 'KNOWLEDGE BASE',
    title: 'FAQ พร้อมข้อมูลอ้างอิง',
    description: 'เพิ่มและจัดการคำถามที่พบบ่อย รวมถึงข้อมูลสินค้าและบริการของแต่ละร้าน',
    image: '/assets/home/faq.png',
    card: 'bg-white text-[#18345c] border-[#e8def8]',
    labelColor: 'text-[#6d5bb8]',
    imageBox: 'bg-[#f5f0ff]',
  },
  {
    number: '03',
    label: 'LINE CHANNEL',
    title: 'คุยกับลูกค้าผ่าน LINE',
    description: 'เชื่อม LINE Official Account และทดลองคำตอบผ่าน Simulator ก่อนใช้งาน',
    image: '/assets/home/line.png',
    card: 'bg-white text-[#18345c] border-[#d5f7e2]',
    labelColor: 'text-[#10995a]',
    imageBox: 'bg-[#eafbf1]',
  },
  {
    number: '04',
    label: 'WEBHOOK',
    title: 'เชื่อมต่ออย่างเป็นระบบ',
    description: 'ตั้งค่า Webhook ตรวจสถานะการเชื่อมต่อ และแยกข้อมูลข้อความตามร้าน',
    image: '/assets/home/webhook.png',
    card: 'bg-white text-[#18345c] border-[#d8edf8]',
    labelColor: 'text-[#178dc5]',
    imageBox: 'bg-[#edf8fd]',
  },
];

function StoreIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="5" className="size-20 text-white">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 43h60l-5-18H25l-5 18Zm5 0v32h50V43M40 75V57h20v18M20 43c0 8 10 10 15 3 5 7 15 7 20 0 5 7 15 7 20 0 5 7 15 5 15-3" />
    </svg>
  );
}

export default function HomeFeatures() {
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-24 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-bold tracking-[.18em] text-[#118d91] uppercase">WHAT YOU CAN DO</p>
          <h2 id="features-title" className="mt-4 text-3xl font-bold tracking-tight text-[#18345c] sm:text-4xl">
            เครื่องมือสำหรับร้านเล็ก
            <br />
            <span className="text-[#4564c9]">ที่พร้อมเติบโตไปด้วยกัน</span>
          </h2>
          <p className="mt-5 text-base leading-8 text-slate-600">
            ทุกส่วนเริ่มจากข้อมูลของร้านคุณ แล้วนำไปช่วยตอบคำถามลูกค้าผ่าน LINE
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {features.map((feature) => (
            <article key={feature.number} className={`flex h-full flex-col rounded-[28px] border-2 p-5 shadow-[0_18px_36px_-26px_rgba(28,61,111,.3)] transition hover:-translate-y-1 hover:shadow-[0_24px_42px_-24px_rgba(28,61,111,.35)] ${feature.card}`}>
              <div className={`flex h-36 items-center justify-center rounded-[20px] ${feature.imageBox}`}>
                {feature.image ? (
                  <Image src={feature.image} alt="" width={128} height={128} sizes="128px" className="h-28 w-28 object-contain" />
                ) : (
                  <StoreIcon />
                )}
              </div>
              <div className="mt-6 flex items-center justify-between gap-3">
                <span className={`text-[11px] font-bold tracking-[.14em] ${feature.labelColor}`}>{feature.label}</span>
                <span className={`text-xs font-semibold ${feature.labelColor}`}>{feature.number}</span>
              </div>
              <h3 className="mt-3 text-xl font-bold leading-7">{feature.title}</h3>
              <p className={`mt-3 text-sm leading-7 ${feature.image ? 'text-slate-600' : 'text-white/90'}`}>
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
