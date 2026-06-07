// Return Case — browser-only helpers (forms, Print button, child grid preload).
// Server save rules live in returnCase.js; PDF layout in returnCasePdf.js.
// Do not move this logic into generic component files.

/**
 * Return Case client helpers.
 *
 * This file handles things that only run in the browser:
 * - Which case rows appear in the case picker
 * - Preloading standard return reasons on a new form
 * - Downloading the PDF when the user clicks Print
 *
 * Operator guide for the letter PDF: docs/return-case-pdf.md
 */
import { useEffect, useMemo, useRef } from "react";
import { rowValueForField } from "../gridRowValue";

/** True when the current screen is the Return Case module. */
export function isReturnCaseModule(moduleKey) {
  return moduleKey === "return_case";
}

/** Child rows where the user ticked Select (same rule as save and PDF). */
export function filterCheckedReturnCaseDetails(rows) {
  return (rows || []).filter((row) => row?.select === true || Number(row?.select) === 1);
}

/**
 * Before save: send only checked detail rows to the server.
 * Unchecked lines are dropped so they are not stored.
 */
export function applyReturnCaseSubmitBody(moduleKey, body) {
  if (!isReturnCaseModule(moduleKey)) return body;
  const next = { ...(body || {}) };
  const childRows = { ...(next.childTableRows || {}) };
  childRows.return_case_details = filterCheckedReturnCaseDetails(childRows.return_case_details || []);
  next.childTableRows = childRows;
  return next;
}

/** Show the post-save Print popup when editing an existing Return Case. */
export function shouldShowReturnCaseAckOnEdit(moduleKey, editingRow) {
  return isReturnCaseModule(moduleKey) && Boolean(editingRow);
}

/** Label on the Print toolbar button. */
export function getReturnCasePrintButtonText() {
  return "Print";
}

/** Label on the Print button in the post-save acknowledgement dialog. */
export function getReturnCaseAckPrintLabel(configuredLabel) {
  return configuredLabel || "Print";
}

/**
 * Record id to use for Print — selected row in view mode, or current edit id in form mode.
 * Returns null when Print should not be shown.
 */
export function getReturnCasePrintTargetId({
  moduleKey,
  canView,
  effectiveViewMode,
  selectedId,
  editingRowId
}) {
  if (!isReturnCaseModule(moduleKey) || !canView) return null;
  return effectiveViewMode ? selectedId : editingRowId ?? null;
}

/** Ref no (or case label) used as a hint for the downloaded PDF file name. */
export function returnCaseRefHintFromRow(row) {
  return (
    String(rowValueForField(row || {}, "refNo") ?? "").trim() ||
    String(rowValueForField(row || {}, "caseNoLabel") ?? "").trim()
  );
}

/** Read file name from the API Content-Disposition header. */
function contentDispositionFilename(headerValue) {
  const cd = String(headerValue || "").trim();
  if (!cd) return "";
  const m = cd.match(/filename="([^"]+)"/i) || cd.match(/filename\*=UTF-8''([^;\s]+)/i);
  if (!m) return "";
  try {
    return decodeURIComponent(String(m[1]).replace(/"/g, ""));
  } catch {
    return String(m[1]).replace(/"/g, "");
  }
}

/** Trigger a file download in the browser (same pattern as invoice PDFs). */
function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Fetch the Return Case PDF from the server and save it to the user's Downloads folder.
 * Same behaviour as downloadRecoveryInvoicePdf — does not open a new browser tab.
 *
 * @param {string|number} recordId — return_case.id
 * @param {string} [refHint] — ref no for fallback file name (RETURN_<ref>.pdf)
 */
export async function downloadReturnCasePdf(recordId, refHint) {
  if (recordId == null || String(recordId).trim() === "") return;
  const res = await fetch(`/api/return-case/pdf/${recordId}`);
  const blob = await res.blob();
  if (!res.ok) {
    let msg = "Failed to download PDF";
    try {
      const j = JSON.parse(await blob.text());
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const name =
    contentDispositionFilename(res.headers.get("Content-Disposition")) ||
    (refHint ? `RETURN_${String(refHint).replace(/\//g, "_")}.pdf` : "RETURN.pdf");
  triggerBlobDownload(blob, name);
}

/**
 * React hook: case picker filters and preload return reasons on new entry.
 * Preload fills the child grid from case_return_reasons master (user still ticks Select).
 */
export function useReturnCaseClientModel({
  moduleKey,
  editingRow,
  formKey,
  childTables,
  createDraftRow,
  setChildRowsByKey
}) {
  const preloadLoadedKeyRef = useRef("");
  const preloadInFlightKeyRef = useRef("");
  const entryFieldUiOverrides = useMemo(() => {
    if (!isReturnCaseModule(moduleKey)) return null;
    const parentRecordId =
      editingRow?.id != null && String(editingRow.id).trim() !== "" ? String(editingRow.id) : "";
    return {
      caseNo: {
        lookup: {
          extraLovParams: {
            return_case_case_picker: "1",
            ...(parentRecordId ? { return_case_parent_id: parentRecordId } : {})
          }
        }
      }
    };
  }, [moduleKey, editingRow?.id]);

  useEffect(() => {
    if (!isReturnCaseModule(moduleKey)) return;
    if (editingRow) return;
    // New return case: load standard reasons from master; user ticks Select and fills text.
    const preloadKey = `${moduleKey}|new|${String(formKey)}`;
    if (preloadLoadedKeyRef.current === preloadKey) return;
    if (preloadInFlightKeyRef.current === preloadKey) return;
    preloadInFlightKeyRef.current = preloadKey;
    let cancelled = false;
    async function preloadReturnReasons() {
      try {
        const q = new URLSearchParams({
          page: "1",
          limit: "500",
          sortBy: "sequence",
          sortDir: "asc",
          f_active: "Yes"
        });
        const res = await fetch(`/api/crud/case_return_reasons?${q.toString()}`);
        const text = await res.text();
        const payload = text ? JSON.parse(text) : null;
        if (!res.ok || cancelled) return;
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        const detailsCfg = (childTables || []).find((ct) => (ct.key || ct.table) === "return_case_details");
        const seeded = rows
          .map((r, idx) => {
            const reason = String(rowValueForField(r, "returnReason") ?? "").trim();
            if (!reason) return null;
            return {
              ...createDraftRow(detailsCfg || null),
              _rowId: `seed-${idx}-${Date.now()}`,
              _editing: false,
              _lineSaved: true,
              select: 0,
              returnReason: reason
            };
          })
          .filter(Boolean);
        if (!cancelled) {
          if (seeded.length > 0) {
            setChildRowsByKey({ return_case_details: seeded });
          }
          preloadLoadedKeyRef.current = preloadKey;
        }
      } catch {
        // Keep default blank row if preload fails.
      } finally {
        if (preloadInFlightKeyRef.current === preloadKey) {
          preloadInFlightKeyRef.current = "";
        }
      }
    }
    preloadReturnReasons();
    return () => {
      cancelled = true;
      if (preloadInFlightKeyRef.current === preloadKey) {
        preloadInFlightKeyRef.current = "";
      }
    };
  }, [moduleKey, editingRow, formKey, childTables, createDraftRow, setChildRowsByKey]);

  return { entryFieldUiOverrides };
}

