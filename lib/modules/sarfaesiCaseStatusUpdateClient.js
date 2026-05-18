/**
 * SARFAESI Case Status Update — browser-only behaviour (safe for MasterModuleClient).
 *
 * - Case picker: only SARFAESI cases not already on another status-update record.
 * - New entry: preloads all active particulars into the child grid (remarks blank).
 * - Case snapshot button (same pattern as Return Case / Public Notice).
 *
 * Do not import `sarfaesiCaseStatusUpdate.js` here — it pulls in MySQL and breaks the Next.js build.
 */

import { useEffect, useMemo, useRef } from "react";
import { rowValueForField } from "../gridRowValue";

const SARFAESI_CASE_STATUS_UPDATE_DETAILS_CHILD_KEY = "sarfaesi_case_status_update_details";

export function isSarfaesiCaseStatusUpdateModule(moduleKey) {
  return moduleKey === "sarfaesi_case_status_update";
}

export function isSarfaesiCaseStatusUpdateCaseSnapshotModule(moduleKey) {
  return isSarfaesiCaseStatusUpdateModule(moduleKey);
}

export function useSarfaesiCaseStatusUpdateClientModel({
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
    if (!isSarfaesiCaseStatusUpdateModule(moduleKey)) return null;
    const parentRecordId =
      editingRow?.id != null && String(editingRow.id).trim() !== "" ? String(editingRow.id) : "";
    return {
      caseNo: {
        lookup: {
          extraLovParams: {
            sarfaesi_case_status_update_case_picker: "1",
            ...(parentRecordId ? { sarfaesi_case_status_update_parent_id: parentRecordId } : {})
          }
        }
      }
    };
  }, [moduleKey, editingRow?.id]);

  useEffect(() => {
    if (!isSarfaesiCaseStatusUpdateModule(moduleKey)) return;
    if (editingRow) return;
    const preloadKey = `${moduleKey}|new|${String(formKey)}`;
    if (preloadLoadedKeyRef.current === preloadKey) return;
    if (preloadInFlightKeyRef.current === preloadKey) return;
    preloadInFlightKeyRef.current = preloadKey;
    let cancelled = false;

    async function preloadParticulars() {
      try {
        const q = new URLSearchParams({
          page: "1",
          limit: "500",
          sortBy: "sequence",
          sortDir: "asc",
          f_active: "Yes"
        });
        const res = await fetch(`/api/crud/sarfaesi_case_particulars?${q.toString()}`);
        const text = await res.text();
        const payload = text ? JSON.parse(text) : null;
        if (!res.ok || cancelled) return;
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        const detailsCfg = (childTables || []).find(
          (ct) => (ct.key || ct.table) === SARFAESI_CASE_STATUS_UPDATE_DETAILS_CHILD_KEY
        );
        const seeded = rows
          .map((r, idx) => {
            const particularsId = asPositiveInt(rowValueForField(r, "id"));
            if (!particularsId) return null;
            return {
              ...createDraftRow(detailsCfg || null),
              _rowId: `seed-${idx}-${Date.now()}`,
              _editing: false,
              _lineSaved: true,
              particulars: particularsId,
              remarks: ""
            };
          })
          .filter(Boolean);
        if (!cancelled && seeded.length > 0) {
          setChildRowsByKey({ [SARFAESI_CASE_STATUS_UPDATE_DETAILS_CHILD_KEY]: seeded });
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

    preloadParticulars();
    return () => {
      cancelled = true;
      if (preloadInFlightKeyRef.current === preloadKey) {
        preloadInFlightKeyRef.current = "";
      }
    };
  }, [moduleKey, editingRow, formKey, childTables, createDraftRow, setChildRowsByKey]);

  return { entryFieldUiOverrides };
}

function asPositiveInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}
