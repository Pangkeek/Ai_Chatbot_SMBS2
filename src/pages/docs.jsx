import Head from 'next/head';
import ApiConsole from '@/components/ApiConsole';

export default function DocsPage() {
  return <>
    <Head><title>SMB Chatbot · API Console</title></Head>
    <ApiConsole />
  </>;
}
