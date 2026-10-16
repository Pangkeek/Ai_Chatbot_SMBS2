import BusinessSettingsView from './BusinessSettingsView.jsx';
import DashboardHeader from './DashboardHeader.jsx';
import DashboardHomeView from './DashboardHomeView';
export default function DashboardView() {
  return (
    <div id="dashboard-view" className="app-graph-paper hidden min-h-screen">
        <DashboardHeader />

        <DashboardHomeView />
      <BusinessSettingsView />
      </div>
  );
}
