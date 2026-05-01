// Application route/page/API handler for this feature area.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Dashboard area: requires login; builds sidebar from modules the user may access (any of view/create/edit/delete); mounts tabbed
 * module panels (see DashboardTabs). `children` from the layout is not used for module body—tabs render clients.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { modules } from "../../config/modules";
import { dashboards } from "../../config/dashboards";
import { getSessionUser } from "../../lib/session";
import { hasAnyModuleAccess } from "../../lib/rbac";
import DashboardSidebar from "../../components/DashboardSidebar";
import DashboardTopbar from "../../components/DashboardTopbar";
import TopbarGreeting from "../../components/TopbarGreeting";
import { DashboardUserProvider } from "../../components/DashboardUserProvider";
import InactivityLogout from "../../components/InactivityLogout";
import DashboardTabs from "../../components/DashboardTabs";
import AppFooter from "../../components/AppFooter";

/** Authenticated shell: sidebar, theme, idle logout, and RBAC-filtered menu. */
export default async function DashboardLayout({ children }) {
  // Read httpOnly session cookie and resolve the logged-in user on the server.
  const cookieStore = await cookies();
  const sid = cookieStore.get("session")?.value;
  const user = await getSessionUser(sid);

  if (!user) {
    // Without a valid session, force the user back to login.
    redirect("/login");
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

  // Convert visible modules into sidebar groups (group name -> list of links).
  const groups = visibleEntries.reduce((acc, [key, config]) => {
    const groupName = config.group || "Other";
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push({ key, label: config.label || key, icon: config.icon || "📄" });
    return acc;
  }, {});

  // Landing dashboards: visible only when user has permission on dashboard permission key.
  const visibleDashboards = [];
  for (const d of dashboards) {
    const permissionKey = String(d.permissionKey || d.key || "").trim();
    if (!permissionKey) continue;
    const canSee = await hasAnyModuleAccess(user, permissionKey);
    if (canSee) visibleDashboards.push(d);
  }

  return (
    <DashboardUserProvider
      fullName={user.fullName}
      email={user.email}
      unitId={user.unit != null ? Number(user.unit) : null}
    >
      <div className="flux-layout">
        <DashboardSidebar groups={groups} />
        <main className="flux-main flux-main--with-footer">
          <InactivityLogout />
          <header className="flux-topbar">
            <TopbarGreeting />
            <DashboardTopbar userEmail={user.email} />
          </header>
          <div className="flux-main-scroll-region">
            <div className="flux-content">
              <DashboardTabs
                visibleModuleKeys={visibleEntries.map(([k]) => k)}
                visibleDashboards={visibleDashboards}
              />
            </div>
          </div>
          <AppFooter />
        </main>
      </div>
    </DashboardUserProvider>
  );
}
