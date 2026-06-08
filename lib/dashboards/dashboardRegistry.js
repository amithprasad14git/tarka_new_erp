// Dashboard registry — maps config key to loadDashboard implementation file.

/**
 * Lookup table: each key in config/dashboards.js must have a matching import here.
 * Runners export `loadDashboard(user)`.
 */

import * as unitWiseRecoveryTarget from "./unit_wise_recovery_target/run.js";

const DASHBOARD_RUNNERS = {
  unit_wise_recovery_target: unitWiseRecoveryTarget
};

/**
 * @param {string} dashboardKey
 * @returns {{ loadDashboard: Function } | null}
 */
export function getDashboardRunner(dashboardKey) {
  return DASHBOARD_RUNNERS[dashboardKey] ?? null;
}
