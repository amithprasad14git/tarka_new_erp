/**
 * View-grid column emphasis: bold brand styling for key reference columns per module.
 */

/** @type {Record<string, Set<string>>} */
const VIEW_GRID_EMPHASIS_BY_MODULE = Object.freeze(
  Object.fromEntries(
    Object.entries({
      new_case_inward: ["caseNo"],
      sarfaesi_case_status_update: ["caseNo"],
      recovery_invoice: ["invoiceNo", "caseNo"],
      sarfaesi_invoice: ["invoiceNo", "caseNo"],
      vehicle_invoice: ["invoiceNo", "caseNo"],
      invoices_received: ["refNo"],
      transfer_case: ["caseNo"],
      public_notice: ["caseNo"],
      return_case: ["caseNo"]
    }).map(([moduleKey, fields]) => [moduleKey, new Set(fields)])
  )
);

export const VIEW_GRID_EMPHASIS_CELL_CLASS = "master-view-grid-emphasis-col";
export const VIEW_GRID_EMPHASIS_VALUE_CLASS = "master-view-grid-emphasis-value";

export function isViewGridEmphasisField(moduleKey, fieldName) {
  const fields = VIEW_GRID_EMPHASIS_BY_MODULE[String(moduleKey ?? "").trim()];
  if (!fields) return false;
  return fields.has(String(fieldName ?? "").trim());
}

export function getViewGridColumnClass(moduleKey, fieldName) {
  return isViewGridEmphasisField(moduleKey, fieldName) ? VIEW_GRID_EMPHASIS_CELL_CLASS : "";
}
