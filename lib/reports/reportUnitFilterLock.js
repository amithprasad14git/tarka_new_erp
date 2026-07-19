// Shared report helper — lock Unit filter to session unit for role-2 operators.
// Applies only to the case-related report keys listed below (not accounts reports).
// Menu group labels are not used — report keys are stable IDs.

/** Case-related reports that lock Unit for role 2. */
export const CASE_REPORT_UNIT_LOCK_KEYS = new Set([
  "report_new_case_inward_register",
  "report_pending_cases_on_hand",
  "report_search_loan_ac",
  "report_part_recovered_cases",
  "report_returned_cases",
  "report_settled_cases",
  "report_region_wise_cumulative_report",
  "report_sarfaesi_case_report"
]);

/**
 * Session unit to force on case reports for role-2 users.
 * @param {string} reportKey
 * @param {unknown} role
 * @param {unknown} unit
 * @returns {number | null}
 */
export function getLockedReportUnitId(reportKey, role, unit) {
  if (!CASE_REPORT_UNIT_LOCK_KEYS.has(String(reportKey || ""))) return null;
  if (Number(role) !== 2) return null;
  if (unit == null || String(unit).trim() === "") return null;
  const id = Number(unit);
  return Number.isFinite(id) ? id : null;
}
