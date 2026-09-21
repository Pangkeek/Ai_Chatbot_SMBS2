import SiteLayout from '@/layouts/SiteLayout';
import '@/styles/globals.css';

export default function App({ Component, pageProps }) {
  return <SiteLayout><Component {...pageProps} /></SiteLayout>;
}
