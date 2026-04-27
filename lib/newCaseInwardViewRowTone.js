/**
 * New Case Inward — view grid status indicator tone by case status (client only).
 * Labels must match `lookup_value_master` and `lib/newCaseInwardCaseStatus.js`.
 */
import { REOPEN_ALLOWED_FINAL_CASE_STATUS_SET, normalizeNciCaseStatusLabel } from "./newCaseInwardCaseStatus";

/** @returns {"returned"|"final"|"ongoing"} */
export function getNewCaseInwardStatusDotTone(caseStatusLabel) {
  const t = normalizeNciCaseStatusLabel(caseStatusLabel);
  if (!t) return "ongoing";
  if (t === normalizeNciCaseStatusLabel("Returned")) return "returned";
  if (REOPEN_ALLOWED_FINAL_CASE_STATUS_SET.has(t)) return "final";
  return "ongoing";
}
