// Configuration file for project/runtime behavior.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Dashboard registry (landing page cards).
 *
 * Permission model:
 * - Each dashboard maps to one `user_permissions.module` key via `permissionKey`.
 * - If the logged-in user has any access on that key, the card is visible.
 * - Keep this separate from `config/modules.js` (these are dashboards, not CRUD modules).
 */
export const dashboards = [
  {
    key: "cases_overview",
    permissionKey: "dashboard_cases_overview",
    title: "Cases Overview",
    icon: "📊",
    description: "At-a-glance case counts by stage and recent activity.",
    tone: "brand"
  },
  {
    key: "recovery_snapshot",
    permissionKey: "dashboard_recovery_snapshot",
    title: "Recovery Snapshot",
    icon: "💰",
    description: "Recovered amount trends and current totals.",
    tone: "success"
  },
  {
    key: "operations_queue",
    permissionKey: "dashboard_operations_queue",
    title: "Operations Queue",
    icon: "📥",
    description: "Work-in-progress view for operational follow-ups.",
    tone: "info"
  }
];

