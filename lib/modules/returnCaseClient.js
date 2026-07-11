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
 * Operator guide for the letter PDF: README.md#return-case-letter-pdf
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { rowValueForField } from "../gridRowValue";
import { downloadBlobResponse } from "../fetchClientError";
import { apiUserMessage } from "../apiUserMessages";

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

/**
 * Download Return Case PDF for a record (browser save dialog).
 * @param {number|string|null|undefined} recordId
 * @param {string} [refHint]
 */
export async function downloadReturnCasePdf(recordId, refHint) {
  if (recordId == null || String(recordId).trim() === "") return;
  const res = await fetch(`/api/return-case/pdf/${recordId}`);
  const fallbackName =
    refHint ? `RETURN_${String(refHint).replace(/\//g, "_")}.pdf` : "RETURN.pdf";
  await downloadBlobResponse(res, apiUserMessage("downloadPdf"), fallbackName);
}

/**
 * React hook: case picker filters and preload return reasons on new entry.
 * Preload fills the child grid from active return reasons (user still ticks Select).
 * Uses /api/return-case/return-reasons — gated on return_case access, not the master screen.
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
  const [autoValues, setAutoValues] = useState({});
  const [ccToInputKey, setCcToInputKey] = useState(0);

  useEffect(() => {
    if (!isReturnCaseModule(moduleKey)) {
      setAutoValues({});
      setCcToInputKey(0);
      return;
    }
    if (editingRow) {
      setAutoValues({});
      setCcToInputKey(0);
      return;
    }
    setAutoValues({});
    setCcToInputKey(0);
  }, [moduleKey, editingRow, formKey]);

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
      },
      ccTo: {
        inputKey: `ccTo-${ccToInputKey}`
      }
    };
  }, [moduleKey, editingRow?.id, ccToInputKey]);

  function handleFieldValueChange(fieldName, value) {
    if (!isReturnCaseModule(moduleKey)) return false;
    if (fieldName !== "caseNo") return false;

    setAutoValues((prev) => ({ ...prev, ccTo: "" }));
    setCcToInputKey((k) => k + 1);

    const caseId = Number(value);
    if (!Number.isFinite(caseId) || caseId <= 0) {
      return true;
    }

    void (async () => {
      try {
        const res = await fetch(`/api/return-case/cc-to?caseId=${encodeURIComponent(String(caseId))}`);
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          setAutoValues((prev) => ({ ...prev, ccTo: "" }));
          setCcToInputKey((k) => k + 1);
          return;
        }
        const ccTo = String(payload?.ccTo ?? "").trim();
        setAutoValues((prev) => ({ ...prev, ccTo }));
        setCcToInputKey((k) => k + 1);
      } catch {
        setAutoValues((prev) => ({ ...prev, ccTo: "" }));
        setCcToInputKey((k) => k + 1);
      }
    })();

    return true;
  }

  useEffect(() => {
    if (!isReturnCaseModule(moduleKey)) return;
    if (editingRow) return;
    // New return case: load standard reasons; user ticks Select and fills text.
    const preloadKey = `${moduleKey}|new|${String(formKey)}`;
    if (preloadLoadedKeyRef.current === preloadKey) return;
    if (preloadInFlightKeyRef.current === preloadKey) return;
    preloadInFlightKeyRef.current = preloadKey;
    let cancelled = false;
    async function preloadReturnReasons() {
      try {
        const res = await fetch("/api/return-case/return-reasons");
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

  return { entryFieldUiOverrides, autoValues, handleFieldValueChange };
}


