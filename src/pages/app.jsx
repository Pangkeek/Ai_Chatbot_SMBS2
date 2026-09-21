import Head from 'next/head';
import Dashboard from '@/components/Dashboard';

export default function AppPage() {
  return <>
    <Head><title>SMB Chatbot</title><meta name="description" content="จัดการแชตและข้อมูลของแต่ละร้าน" /></Head>
    <Dashboard />
  </>;
}
