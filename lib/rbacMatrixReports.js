// Shared library helper — RBAC matrix entries for report keys.

/**
 * Builds User Permissions matrix rows for every key in config/reports.js.
 * Reports show View only (no Add/Edit/Delete). See docs/REPORTS.md § Permissions.
 */

import { reports } from "../config/reports";

/**
 * @returns {{ key: string, label: string, group: string, isReport: true }[]}
 */
export function getRbacMatrixReportEntries() {
  return Object.entries(reports)
    .map(([key, r]) => ({
      key,
      label: String(r?.label || key),
      group: String(r?.group || "Case Related Reports"),
      isReport: true
    }))
    .sort((a, b) => {
      const g = a.group.localeCompare(b.group);
      if (g !== 0) return g;
      return a.label.localeCompare(b.label);
    });
}

export function getRbacMatrixReportKeySet() {
  return new Set(getRbacMatrixReportEntries().map((e) => e.key));
}
