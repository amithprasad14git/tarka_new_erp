// Module-specific file: contains business rules for this module only.
// Do not move this logic into generic/shared files.

/**
 * Return Case client-only helpers.
 * Keep Return Case UI conditions out of generic component files.
 */
import { useEffect, useMemo, useRef } from "react";
import { rowValueForField } from "../gridRowValue";

export function isReturnCaseModule(moduleKey) {
  return moduleKey === "return_case";
}

export function filterCheckedReturnCaseDetails(rows) {
  return (rows || []).filter((row) => row?.select === true || Number(row?.select) === 1);
}

export function applyReturnCaseSubmitBody(moduleKey, body) {
  if (!isReturnCaseModule(moduleKey)) return body;
  const next = { ...(body || {}) };
  const childRows = { ...(next.childTableRows || {}) };
  childRows.return_case_details = filterCheckedReturnCaseDetails(childRows.return_case_details || []);
  next.childTableRows = childRows;
  return next;
}

export function shouldShowReturnCaseAckOnEdit(moduleKey, editingRow) {
  return isReturnCaseModule(moduleKey) && Boolean(editingRow);
}

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
