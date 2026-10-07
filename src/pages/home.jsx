import Head from 'next/head';
import HomeHeader from '@/components/home/HomeHeader';
import HomeHero from '@/components/home/HomeHero';
import HomeFeatures from '@/components/home/HomeFeatures';
import HomeJourney from '@/components/home/HomeJourney';
import HomeFooter from '@/components/home/HomeFooter';

export default function HomePage() {
  return (
    <>
      <Head>
        <title>SMB Chatbot | ผู้ช่วยตอบแชตสำหรับร้านของคุณ</title>
        <meta name="description" content="รู้จักระบบจัดการร้าน คลังความรู้ และการเชื่อมต่อ LINE ของ SMB Chatbot" />
      </Head>
      <div className="home-page">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">
          ข้ามไปยังเนื้อหา
        </a>
        <HomeHeader />
        <main id="main-content" className="home-graph-paper min-h-screen text-[var(--home-ink)]">
          <HomeHero />
          <HomeFeatures />
          <HomeJourney />
        </main>
        <HomeFooter />
      </div>
    </>
  );
}
