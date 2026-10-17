import Image from 'next/image';
import Link from 'next/link';

const highlights = ['ข้อมูลร้านแยกเป็นสัดส่วน', 'FAQ และคลังความรู้', 'เชื่อมต่อ LINE'];

export default function HomeHero() {
  return (
    <section className="relative isolate overflow-hidden bg-[var(--home-blue)] text-white">
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 bottom-0 size-80 rounded-full border-[54px] border-white/5" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-28 -top-32 size-[30rem] rounded-full bg-[#8dbbff]/25 blur-3xl" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,450px)] lg:gap-20 lg:pb-24 lg:pt-20">
        <div>
          <h1 className="max-w-2xl text-[clamp(2.5rem,5vw,4.65rem)] font-bold leading-[1.15] tracking-tight">
            ให้ร้านของคุณ
            <br />
            <span className="text-[#a4f0e4]">ตอบแชตได้ไว</span>
            <br />
            ดูแลลูกค้าได้ดีขึ้น
          </h1>
          <p className="mt-7 max-w-xl text-base leading-8 text-blue-50 sm:text-lg">
            จัดการข้อมูลร้าน คำถามที่พบบ่อย และการเชื่อมต่อ LINE ในที่เดียว
            เพื่อให้คำตอบอ้างอิงจากข้อมูลของร้านคุณ
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/app" className="inline-flex min-h-13 items-center justify-center gap-3 rounded-2xl bg-white px-7 py-3 text-sm font-bold text-[#3855b8] shadow-lg shadow-blue-950/15 transition hover:-translate-y-0.5 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              เข้าสู่ระบบ / เริ่มใช้งาน <span aria-hidden="true">→</span>
            </Link>
            <a href="#features" className="inline-flex min-h-13 items-center justify-center rounded-2xl border border-white/40 px-7 py-3 text-sm font-bold text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              สำรวจฟีเจอร์
            </a>
          </div>

          <ul className="mt-9 flex flex-wrap gap-2.5" aria-label="จุดเด่นของระบบ">
            {highlights.map((item) => (
              <li key={item} className="rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-blue-50">
                ✓ {item}
              </li>
            ))}
          </ul>
        </div>

        <figure className="relative mx-auto w-full max-w-[450px] rounded-[30px] bg-white p-3 text-[#18345c] shadow-[0_30px_65px_-22px_rgba(15,32,88,.5)] sm:p-4">
          <div aria-hidden="true" className="absolute -right-3 top-10 -z-10 size-20 rounded-3xl bg-[#36bcb3] rotate-12" />
          <div aria-hidden="true" className="absolute -bottom-4 left-8 -z-10 h-20 w-36 rounded-3xl bg-[#ff8842] -rotate-6" />
          {/* ภาพต้นฉบับเป็นโปสเตอร์แนวตั้ง จึงแสดงเต็มสัดส่วนและเปิดภาพเดิมเพื่ออ่านข้อความเล็กได้ */}
          <a href="/assets/home/project-infographic.png" target="_blank" rel="noopener noreferrer" aria-label="เปิดอินโฟกราฟิกโครงการขนาดเต็ม" className="block overflow-hidden rounded-[20px] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#ff8842]">
            <Image
              src="/assets/home/project-infographic.png"
              alt="อินโฟกราฟิกสรุปแนวคิด วัตถุประสงค์ วิธีดำเนินงาน และผลของโครงการ AI Chatbot สำหรับธุรกิจ SMBs"
              width={404}
              height={704}
              sizes="(max-width: 640px) 84vw, (max-width: 1024px) 404px, 420px"
              className="h-auto w-full"
            />
          </a>
          <figcaption className="flex items-center justify-between gap-3 px-1 pb-1 pt-3 text-xs font-semibold text-[#4564c9]">
            <span>ภาพรวมแนวคิดของโครงการ</span>
            <span>ดูภาพเต็ม ↗</span>
          </figcaption>
        </figure>
      </div>
      <div aria-hidden="true" className="h-2 bg-[#36bcb3]" />
    </section>
  );
}
