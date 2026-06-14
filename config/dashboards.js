// Configuration file for project/runtime behavior.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Dashboard registry (landing page cards + landing widgets).
 *
 * Permission model:
 * - Each dashboard maps to one `user_permissions.module` key via `permissionKey`.
 * - If the logged-in user has any access on that key, the card/widget is visible.
 * - Per-dashboard settings may also live in config/dashboards/<key>.js.
 */
export const dashboards = [
  {
    key: "unit_wise_recovery_target",
    permissionKey: "dashboard_unit_wise_recovery_target",
    title: "Unit Wise Recovery Target",
    icon: "🎯",
    description: "Recovery achieved vs target for your unit (current financial year).",
    tone: "brand",
    landingWidget: true,
    /** Role 2+ users with an assigned unit see this without an explicit matrix row. */
    autoGrantForAssignedUnit: true
  },
  {
    key: "my_tasks",
    permissionKey: "dashboard_my_tasks",
    title: "My Tasks",
    icon: "✅",
    description: "Create, view, and update tasks assigned to you.",
    tone: "brand",
    landingWidget: true
  },
  {
    key: "my_reminders",
    permissionKey: "dashboard_my_reminders",
    title: "My Reminders",
    icon: "🔔",
    description: "Create, view, and manage your personal reminders.",
    tone: "brand",
    landingWidget: true
  }
];
