import { useDashboardController } from "../hooks/useDashboardController";
import AuthView from './dashboard/AuthView.jsx';
import DashboardView from './dashboard/DashboardView.jsx';
import KnowledgeDeleteModal from './dashboard/KnowledgeDeleteModal.jsx';
import KnowledgeEditorModal from './dashboard/KnowledgeEditorModal.jsx';
import Notification from './dashboard/Notification.jsx';

export default function Dashboard() {
  // Controller อ้างองค์ประกอบด้วย id หลัง mount ทุก component จึงต้องคง id เดิมไว้
  useDashboardController();

  return (
    <div className="app-page">
      <Notification />

      <AuthView />

      <DashboardView />

      <KnowledgeEditorModal />

      <KnowledgeDeleteModal />
    </div>
  );
}
