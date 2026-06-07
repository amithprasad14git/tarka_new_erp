// Application route/page/API handler for this feature area.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * `/dashboard` landing:
 * Dashboard layout renders the shared tab container, but this page returns `null`
 * so the initial state is an empty module selection.
 */
export default async function DashboardIndexPage() {
  // Tabs UI lives in layout; this route intentionally renders nothing.
  return null;
}

