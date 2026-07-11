// Shared library helper — RBAC matrix rows for dashboard permission keys.

/**
 * Builds "Dashboards" group entries for User Permissions matrix from config/dashboards.js.
 * Each dashboard is view-only (no add/edit/delete columns).
 */

import { dashboards } from "../config/dashboards";

/**
 * Sorted list for User Permissions matrix — one row per dashboard permission key.
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

/** Set of all dashboard permission keys for quick lookup in RBAC checks. */
export function getRbacMatrixDashboardKeySet() {
  return new Set(getRbacMatrixDashboardEntries().map((e) => e.key));
}

