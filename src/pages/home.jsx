import Head from 'next/head';

export default function HomePage() {
  return (
    <>
      <Head>
        <title>SMB Chatbot | ผู้ช่วยตอบแชตสำหรับร้านของคุณ</title>
        <meta name="description" content="รู้จักระบบจัดการร้าน คลังความรู้ และการเชื่อมต่อ LINE ของ SMB Chatbot" />
      </Head>
      <main id="main-content" className="min-h-screen bg-[#f7f9fc] text-slate-900" />
    </>
  );
}
