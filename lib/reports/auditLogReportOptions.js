// Report helper — Module and Action filter options for Audit Log Report.

import { modules } from "../../config/modules";

/** @type {{ label: string, value: string }[]} */
export const AUDIT_LOG_ACTION_OPTIONS = [
  { label: "Create", value: "create" },
  { label: "Update", value: "update" },
  { label: "Delete", value: "delete" }
];

/**
 * Sorted select options for all auditable CRUD modules (excludes audit_logs itself).
 * @returns {{ label: string, value: string }[]}
 */
export function buildAuditLogModuleFilterOptions() {
  return Object.entries(modules)
    .filter(([key]) => key !== "audit_logs")
    .map(([value, mod]) => ({
      label: String(mod?.label || value).trim() || value,
      value
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
