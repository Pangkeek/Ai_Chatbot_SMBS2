import LineIntegrationSection from './LineIntegrationSection.jsx';
import KnowledgeManagementSection from './KnowledgeManagementSection.jsx';
import BusinessDetailsSection from './BusinessDetailsSection.jsx';
export default function BusinessSettingsView() {
  return (
    <main
        id="business-settings-view"
        className="mx-auto hidden max-w-5xl px-4 py-8 sm:px-6 lg:px-8"
      >
        <button
          id="settings-back-button"
          type="button"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-blue-600"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="size-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m14.25 18-6-6 6-6"
            />
          </svg>
          กลับไปหน้าร้านค้า
        </button>

        <div className="app-dashboard-hero relative mt-6 overflow-hidden rounded-[30px] p-6 text-white sm:p-8">
          <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 size-52 rounded-full border-[32px] border-white/10" />
          <p id="settings-eyebrow" className="relative text-sm font-semibold text-[#a4f0e4]">
            Business Settings
          </p>

          <h1 id="settings-title" className="relative mt-2 text-3xl font-bold tracking-tight text-white">
            ตั้งค่าข้อมูลธุรกิจ
          </h1>

          <p id="settings-description-text" className="relative mt-3 text-sm leading-6 text-blue-50">
            ข้อมูลส่วนนี้จะช่วยให้ Chatbot เข้าใจร้านและตอบลูกค้าได้เหมาะสมขึ้น
          </p>
        </div>

        <nav
          className="outlined-panel mt-7 flex gap-2 overflow-x-auto rounded-2xl border border-[#dbe5fb] bg-white p-1.5 shadow-sm"
          aria-label="เมนูจัดการร้าน"
        >
          <button
            id="settings-business-tab"
            type="button"
            className="app-settings-tab app-settings-tab--active"
            aria-controls="business-settings-section"
            aria-selected="true"
          >
            ข้อมูลธุรกิจ
          </button>
          <button
            id="settings-knowledge-tab"
            type="button"
            className="app-settings-tab"
            aria-controls="knowledge-management-section"
            aria-selected="false"
          >
            FAQ และคลังความรู้
          </button>
          <button
            id="settings-line-tab"
            type="button"
            className="app-settings-tab"
            aria-controls="line-integration-section"
            aria-selected="false"
          >
            การเชื่อมต่อ LINE
          </button>
        </nav>

        <div className="mt-6">
          <div className="space-y-8">
            <BusinessDetailsSection />

            <KnowledgeManagementSection />

            <LineIntegrationSection />
          </div>
        </div>
      </main>
  );
}
