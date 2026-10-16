import { useApiConsoleController } from "../hooks/useApiConsoleController";
import AuthenticationSection from './api-console/AuthenticationSection.jsx';
import ConsoleFooter from './api-console/ConsoleFooter.jsx';
import ConsoleIntro from './api-console/ConsoleIntro.jsx';
import RequestSection from './api-console/RequestSection.jsx';

export default function ApiConsole() {
  useApiConsoleController();

  return (
    <div className="min-h-screen bg-[#f2f5f7] font-sans text-[#182a38]">
      <main className="mx-auto max-w-[1000px] px-4 py-7 min-[601px]:px-6 min-[601px]:py-12">
        <ConsoleIntro />
        <AuthenticationSection />
        <RequestSection />
        <ConsoleFooter />
      </main>
    </div>
  );
}
