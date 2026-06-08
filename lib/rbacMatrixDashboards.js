// Shared library helper — RBAC matrix entries for dashboard keys.

/**
 * Builds User Permissions matrix rows for every key in config/dashboards.js.
 * Dashboards show View only (no Add/Edit/Delete), same as reports.
 */

import { dashboards } from "../config/dashboards";

/**
 * @returns {{ key: string, label: string, group: string, isDashboard: true }[]}
 */
export function getRbacMatrixDashboardEntries() {
  return dashboards
    .map((d) => ({
      key: String(d?.permissionKey || d?.key || "").trim(),
      label: String(d?.title || d?.key || ""),
      group: "Dashboards",
      isDashboard: true
    }))
    .filter((e) => e.key)
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function getRbacMatrixDashboardKeySet() {
  return new Set(getRbacMatrixDashboardEntries().map((e) => e.key));
}
