// Application page layout — dashboard workspace (sidebar, tabs, landing widgets).

/**
 * Dashboard area: requires login; builds sidebar from modules/reports the user may access;
 * filters landing widgets by dashboard permission (config/dashboards.js).
 * Mounts DashboardTabs which renders KPI widgets on /dashboard home.
 * Guide: docs/DASHBOARDS.md
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { modules } from "../../config/modules";
import { reports } from "../../config/reports";
import { dashboards } from "../../config/dashboards";
import { getSessionInvalidReason, getSessionUser, sessionLoginReasonForInvalid } from "../../lib/session";
import { hasAnyModuleAccess } from "../../lib/rbac";
import { canAccessDashboardByPermissionKey } from "../../lib/dashboards/dashboardAccess";
import DashboardSidebar from "../../components/DashboardSidebar";
import DashboardTopbar from "../../components/DashboardTopbar";
import TopbarGreeting from "../../components/TopbarGreeting";
import TopbarWeather from "../../components/TopbarWeather";
import { DashboardUserProvider } from "../../components/DashboardUserProvider";
import InactivityLogout from "../../components/InactivityLogout";
import DashboardTabs from "../../components/DashboardTabs";
import AppFooter from "../../components/AppFooter";
import DashboardAlertsProvider from "../../components/dashboard/DashboardAlertsProvider";
import "../../components/task/task.css";
import "../../components/reminder/reminder.css";

// Protected workspace shell: sidebar menu, tabs, idle logout, RBAC-filtered modules.
export default async function DashboardLayout({ children }) {
  // Read httpOnly session cookie and resolve the logged-in user on the server.
  const cookieStore = await cookies();
  const sid = cookieStore.get("session")?.value;
  const user = await getSessionUser(sid);

  if (!user) {
    const invalidReason = await getSessionInvalidReason(sid);
    const reason = sessionLoginReasonForInvalid(invalidReason);
    redirect(`/login?reason=${reason}`);
  }

  // Sidebar: show a module if the user has any CRUD flag (create-only users must still see the module).
  const entries = Object.entries(modules);
  const visibleEntries = [];
  for (const [key, config] of entries) {
    const canAccess = await hasAnyModuleAccess(user, key);
    if (canAccess) {
      visibleEntries.push([key, config]);
    }
  }

  const visibleReportEntries = [];
  for (const [key, config] of Object.entries(reports)) {
    const canAccess = await hasAnyModuleAccess(user, key);
    if (canAccess) visibleReportEntries.push([key, config]);
  }

  const allVisibleKeys = [
    ...visibleEntries.map(([k]) => k),
    ...visibleReportEntries.map(([k]) => k)
  ];

  // Convert visible modules + reports into sidebar groups (group name -> list of links).
  const groups = [...visibleEntries, ...visibleReportEntries].reduce((acc, [key, config]) => {
    const groupName = config.group || "Other";
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push({ key, label: config.label || key, icon: config.icon || "📄" });
    return acc;
  }, {});

  // Landing dashboards: each config entry checked via dashboardAccess (matrix + auto-grant).
  const visibleDashboards = [];
  for (const d of dashboards) {
    const permissionKey = String(d.permissionKey || d.key || "").trim();
    if (!permissionKey) continue;
    const canSee = await canAccessDashboardByPermissionKey(user, permissionKey);
    if (canSee) visibleDashboards.push(d);
  }

  return (
    <DashboardUserProvider
      fullName={user.fullName}
      username={user.username}
      email={user.email}
      unitId={user.unit != null ? Number(user.unit) : null}
    >
      <DashboardAlertsProvider>
        <div className="flux-layout">
          <DashboardSidebar groups={groups} />
          <main className="flux-main flux-main--with-footer">
            <InactivityLogout />
            <header className="flux-topbar">
              <div className="topbar-leading">
                <TopbarGreeting />
                <TopbarWeather />
              </div>
              <DashboardTopbar userUsername={user.username} userFullName={user.fullName} />
            </header>
            {/* Due-items toast renders inside DashboardAlertsBell (topbar) */}
            <div className="flux-main-scroll-region">
              <div className="flux-content">
                <DashboardTabs
                  visibleModuleKeys={allVisibleKeys}
                  visibleDashboards={visibleDashboards}
                />
              </div>
            </div>
            <AppFooter />
          </main>
        </div>
      </DashboardAlertsProvider>
    </DashboardUserProvider>
  );
}

