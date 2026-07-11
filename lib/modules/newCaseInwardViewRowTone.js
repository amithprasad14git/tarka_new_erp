// Module-specific server rules — validations and side effects on save.

// Module-specific file: contains business rules for this module only.
// Do not move this logic into generic/shared files.

/**
 * New Case Inward — view grid status indicator tone by case status (client only).
 * Labels must match `lookup_value_master` and `lib/modules/newCaseInwardCaseStatus.js`.
 */
import { REOPEN_ALLOWED_FINAL_CASE_STATUS_SET, normalizeNciCaseStatusLabel } from "./newCaseInwardCaseStatus";

/** @returns {"returned"|"final"|"ongoing"} */
export function getNewCaseInwardStatusDotTone(caseStatusLabel) {
  // Grid row colour: returned (red), final/closed (muted), or still active (green tone).
  const t = normalizeNciCaseStatusLabel(caseStatusLabel);
  if (!t) return "ongoing";
  // Grid dot colour: returned (red tone), closed/final statuses, or still active.
  if (t === normalizeNciCaseStatusLabel("Returned")) return "returned";
  if (REOPEN_ALLOWED_FINAL_CASE_STATUS_SET.has(t)) return "final";
  return "ongoing";
}


