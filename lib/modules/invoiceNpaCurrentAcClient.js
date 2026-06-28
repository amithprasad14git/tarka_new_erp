/**
 * Browser helper — fetch NPA Current AC when Case No changes on invoice entry forms.
 */

export const INVOICE_NPA_CURRENT_AC_API = "/api/invoice/npa-current-ac";

/**
 * @param {string} fieldName
 * @param {unknown} value
 * @param {React.Dispatch<React.SetStateAction<Record<string, string>>>} setAutoValues
 * @returns {boolean} true when caseNo was handled
 */
export function handleInvoiceCaseNoNpaAutoFill(fieldName, value, setAutoValues) {
  if (fieldName !== "caseNo") return false;

  setAutoValues((prev) => ({ ...prev, npaCurrentAc: "", npaCurrentAcLabel: "" }));

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
        setAutoValues((prev) => ({ ...prev, npaCurrentAc: "", npaCurrentAcLabel: "" }));
        return;
      }
      setAutoValues((prev) => ({
        ...prev,
        npaCurrentAc: String(payload?.npaCurrentAc ?? "").trim(),
        npaCurrentAcLabel: String(payload?.npaCurrentAcLabel ?? "").trim()
      }));
    } catch {
      setAutoValues((prev) => ({ ...prev, npaCurrentAc: "", npaCurrentAcLabel: "" }));
    }
  })();

  return true;
}
