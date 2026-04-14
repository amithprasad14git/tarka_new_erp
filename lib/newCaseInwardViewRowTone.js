/**
 * New Case Inward — view grid status indicator tone by case status (client only).
 * Labels must match lookup_value_master "Case Status" text and stay aligned with
 * lib/modules/newCaseInward.js (FINAL_CASE_STATUSES / REOPEN_ALLOWED_FINAL_CASE_STATUSES).
 */

function norm(v) {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

/** @returns {"returned"|"final"|"ongoing"} */
export function getNewCaseInwardStatusDotTone(caseStatusLabel) {
  const t = norm(caseStatusLabel);
  if (!t) return "ongoing";
  if (t === norm("Returned")) return "returned";
  const greenFinal = new Set(
    ["Closed", "Settled under Compromise", "Regularized/Upgraded", "Auctioned"].map((s) => norm(s))
  );
  if (greenFinal.has(t)) return "final";
  return "ongoing";
}
