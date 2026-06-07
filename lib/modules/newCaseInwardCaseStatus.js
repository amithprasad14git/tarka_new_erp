// Module-specific server rules — validations and side effects on save.

// Module-specific file: contains business rules for this module only.
// Do not move this logic into generic/shared files.

/**
 * New Case Inward — **Case Status** label lists (hardcoded; must match `lookup_value_master` text).
 *
 * Edit statuses here only; import the arrays and/or normalized `Set`s everywhere else
 * (server rules, PDF marks, grid tone, client modals).
 */

/** Case statuses that require at least some recovered amount in the child table. */
export const CASE_STATUS_REQUIRES_RECOVERY = [
  "Closed",
  "Settled under Compromise",
  "Regularized/Upgraded",
  "Auctioned",
  "Part Recovery",
  "Settled Under RINN",
  "Settled by Bank",
  "Renewal/Restructure"
];

/** Final statuses: e.g. role-2 cannot edit records in these states. */
export const FINAL_CASE_STATUSES = [
  "Closed",
  "Settled under Compromise",
  "Regularized/Upgraded",
  "Auctioned",
  "Returned",
  "Settled Under RINN",
  "Settled by Bank",
  "Renewal/Restructure"
];

/**
 * Final statuses that still allow a fresh re-entry for the same loan account.
 * "Returned" is intentionally excluded (duplicate re-entry should stay blocked).
 */
export const REOPEN_ALLOWED_FINAL_CASE_STATUSES = [
  "Closed",
  "Settled under Compromise",
  "Regularized/Upgraded",
  "Auctioned",
  "Settled Under RINN",
  "Settled by Bank",
  "Renewal/Restructure"
];

/** trim + lowercase — same rules as lookup label comparison elsewhere. */
export function normalizeNciCaseStatusLabel(v) {
  // Trim and collapse spaces so grid dots and server rules compare status text reliably.
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

function toNormalizedSet(labels) {
  return new Set((labels || []).map(normalizeNciCaseStatusLabel));
}

export const FINAL_CASE_STATUS_SET = toNormalizedSet(FINAL_CASE_STATUSES);
export const REOPEN_ALLOWED_FINAL_CASE_STATUS_SET = toNormalizedSet(REOPEN_ALLOWED_FINAL_CASE_STATUSES);
export const CASE_STATUS_REQUIRES_RECOVERY_SET = toNormalizedSet(CASE_STATUS_REQUIRES_RECOVERY);

