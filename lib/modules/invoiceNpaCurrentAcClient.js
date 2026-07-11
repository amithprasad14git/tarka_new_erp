/**
 * =============================================================================
 * INVOICE NPA AUTO-FILL (CLIENT) — Case No → NPA Current AC + Bill to Unit
 * =============================================================================
 * Recovery / SARFAESI / Vehicle invoice forms need NPA Current AC and Bill to
 * Unit from the linked New Case Inward row. When the operator changes Case No,
 * this helper clears stale values and fetches fresh ones from the API.
 * =============================================================================
 */

/** API used to resolve NPA Current AC / Bill to Unit for a case id. */
export const INVOICE_NPA_CURRENT_AC_API = "/api/invoice/npa-current-ac";

/**
 * On Case No change: clear then auto-fill NPA Current AC and Bill to Unit.
 * Returns true when the field was `caseNo` (caller should treat it as handled).
 * @param {string} fieldName
 * @param {unknown} value
 * @param {React.Dispatch<React.SetStateAction<Record<string, string>>>} setAutoValues
 * @returns {boolean} true when caseNo was handled
 */
export function handleInvoiceCaseNoNpaAutoFill(fieldName, value, setAutoValues) {
  if (fieldName !== "caseNo") return false;

  setAutoValues((prev) => ({
    ...prev,
    npaCurrentAc: "",
    npaCurrentAcLabel: "",
    billToUnit: "",
    billToUnitLabel: ""
  }));

  const caseId = Number(value);
  if (!Number.isFinite(caseId) || caseId <= 0) {
    return true;
  }

  void (async () => {
    try {
      const res = await fetch(
        `${INVOICE_NPA_CURRENT_AC_API}?caseId=${encodeURIComponent(String(caseId))}`
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAutoValues((prev) => ({
          ...prev,
          npaCurrentAc: "",
          npaCurrentAcLabel: "",
          billToUnit: "",
          billToUnitLabel: ""
        }));
        return;
      }
      setAutoValues((prev) => ({
        ...prev,
        npaCurrentAc: String(payload?.npaCurrentAc ?? "").trim(),
        npaCurrentAcLabel: String(payload?.npaCurrentAcLabel ?? "").trim(),
        billToUnit: String(payload?.billToUnit ?? "").trim(),
        billToUnitLabel: String(payload?.billToUnitLabel ?? "").trim()
      }));
    } catch {
      setAutoValues((prev) => ({
        ...prev,
        npaCurrentAc: "",
        npaCurrentAcLabel: "",
        billToUnit: "",
        billToUnitLabel: ""
      }));
    }
  })();

  return true;
}
