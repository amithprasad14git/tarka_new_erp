// Application page — /dashboard landing (widgets rendered by layout + DashboardTabs).

/**
 * `/dashboard` home route. Returns null because DashboardTabs in layout.js
 * renders landing KPI widgets when no module tab is active.
 * Guide: README.md#5a-landing-dashboards
 */
export default async function DashboardIndexPage() {
  // Tabs UI lives in layout; this route intentionally renders nothing.
  return null;
}


