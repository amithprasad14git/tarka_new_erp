// Shared library helper for reusable application logic.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Modules that appear as rows in the User Permissions matrix (config keys = `user_permissions.module`).
 */
import { modules } from "../config/modules";
import { getRbacMatrixReportEntries } from "./rbacMatrixReports";
import { getRbacMatrixDashboardEntries } from "./rbacMatrixDashboards";

/**
 * @returns {{ key: string, label: string, group: string, isReport?: boolean, isDashboard?: boolean }[]}
 */
export function getRbacMatrixModuleEntries() {
  const crud = Object.entries(modules)
    .map(([key, m]) => ({
      key,
      label: String(m?.label || key),
      group: String(m?.group || ""),
      isReport: false,
      isDashboard: false
    }))
    // Data-entry modules only: menu group, then label.
    .sort((a, b) => {
      const g = a.group.localeCompare(b.group);
      if (g !== 0) return g;
      return a.label.localeCompare(b.label);
    });
  const reportRows = getRbacMatrixReportEntries().map((r) => ({ ...r, isDashboard: false }));
  const dashboardRows = getRbacMatrixDashboardEntries();
  // Section order: CRUD modules → reports → dashboards (no cross-type sort).
  return [...crud, ...reportRows, ...dashboardRows];
}

export function getRbacMatrixModuleKeySet() {
  return new Set(getRbacMatrixModuleEntries().map((e) => e.key));
}

