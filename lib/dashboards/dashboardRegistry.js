// Dashboard registry — maps config key to loadDashboard implementation file.

/**
 * Lookup table: every key in config/dashboards.js must have a matching import here.
 * Each runner exports loadDashboard(user). Wired by dashboard.service.js.
 * Guide: docs/DASHBOARDS.md
 */

import * as unitWiseRecoveryTarget from "./unit_wise_recovery_target/run.js";
import * as searchBankBranch from "./search_bank_branch/run.js";
import * as invoiceCollections from "./invoice_collections/run.js";
import * as regionalPerformance from "./regional_performance/run.js";
import * as myTasks from "./my_tasks/run.js";
import * as myReminders from "./my_reminders/run.js";

const DASHBOARD_RUNNERS = {
  unit_wise_recovery_target: unitWiseRecoveryTarget,
  search_bank_branch: searchBankBranch,
  invoice_collections: invoiceCollections,
  regional_performance: regionalPerformance,
  my_tasks: myTasks,
  my_reminders: myReminders
};

/**
 * Returns the runner module for a dashboard key (loadDashboard function), or null.
 * @param {string} dashboardKey
 * @returns {{ loadDashboard: Function } | null}
 */
export function getDashboardRunner(dashboardKey) {
  return DASHBOARD_RUNNERS[dashboardKey] ?? null;
}
