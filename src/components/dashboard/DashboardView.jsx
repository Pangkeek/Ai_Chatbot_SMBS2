import BusinessSettingsView from './BusinessSettingsView.jsx';
import DashboardHeader from './DashboardHeader.jsx';
import DashboardHomeView from './DashboardHomeView';
export default function DashboardView() {
  return (
    <div id="dashboard-view" className="hidden min-h-screen bg-slate-50">
        <DashboardHeader />

        <DashboardHomeView />
      <BusinessSettingsView />
      </div>
  );
}
