import Head from 'next/head';
import Dashboard from '@/components/Dashboard';
import { parseDashboardRoute } from '@/utils/dashboardRoutes';

export default function AppPage() {
  return <>
    <Head><title>SMB Chatbot</title><meta name="description" content="จัดการแชตและข้อมูลของแต่ละร้าน" /></Head>
    <Dashboard />
  </>;
}

export async function getServerSideProps({ resolvedUrl }) {
  if (!parseDashboardRoute(resolvedUrl)) return { notFound: true };
  return { props: {} };
}
