// Configuration — landing dashboard widgets on the /dashboard home page.

/**
 * Registry of dashboard widgets (KPI panels users see after login on Dashboard home).
 *
 * Each entry needs:
 * - key — used in URL `/api/dashboard/<key>` and React loader
 * - permissionKey — row in User Permissions matrix (group "Dashboards")
 * - landingWidget: true — show on /dashboard grid (not just sidebar cards)
 *
 * Full guide: README.md#5a-landing-dashboards
 * Runners: lib/dashboards/<key>/run.js via lib/dashboards/dashboardRegistry.js
 */
export const dashboards = [
  {
    // Row 1 full width — recovery target vs achieved for current FY.
    key: "unit_wise_recovery_target",
    permissionKey: "dashboard_unit_wise_recovery_target",
    title: "Unit Wise Recovery Target",
    icon: "🎯",
    description: "Recovery achieved vs target for your unit (current financial year).",
    tone: "brand",
    landingWidget: true
  },
  {
    // Personal task summary — counts by status for logged-in user.
    key: "my_tasks",
    permissionKey: "dashboard_my_tasks",
    title: "My Tasks",
    icon: "✅",
    description: "Create, view, and update tasks assigned to you.",
    tone: "brand",
    landingWidget: true
  },
  {
    // Personal reminders list — upcoming items for logged-in user.
    key: "my_reminders",
    permissionKey: "dashboard_my_reminders",
    title: "My Reminders",
    icon: "🔔",
    description: "Create, view, and manage your personal reminders.",
    tone: "brand",
    landingWidget: true
  },
  {
    // Full width — FY settled cases by loan type, region, and month.
    key: "regional_performance",
    permissionKey: "dashboard_regional_performance",
    title: "Regional Performance",
    icon: "📊",
    description: "Settled cases by loan type, region, and month for the current financial year.",
    tone: "brand",
    landingWidget: true
  },
  {
    // Half width — branch lookup tool (paired with Invoice Collections on the same row).
    key: "search_bank_branch",
    permissionKey: "dashboard_search_bank_branch",
    title: "Search Bank & Branch",
    icon: "🔍",
    description: "Find branches by code or name with bank hierarchy.",
    tone: "info",
    landingWidget: true
  },
  {
    // Half width — FY invoice billed vs received (paired with Search Bank & Branch).
    key: "invoice_collections",
    permissionKey: "dashboard_invoice_collections",
    title: "Invoice Collections",
    icon: "💰",
    description: "Billed vs received and pending invoices for the current financial year.",
    tone: "brand",
    landingWidget: true
  }
];

