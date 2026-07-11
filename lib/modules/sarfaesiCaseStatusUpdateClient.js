// Module-specific browser helpers — safe for MasterModuleClient (no MySQL).

/**
 * SARFAESI Case Status Update — browser-only behaviour.
 *
 * - Case picker: only SARFAESI cases not already on another status-update record.
 * - New entry: preloads all active particulars into the child grid (remarks blank).
 * - Case snapshot button (same pattern as Return Case / Public Notice).
 * - Print buttons: 13/2 Covering Sheet, 13/2 Paper Publication, 13(4) Covering Sheet
 *   (view-row select + edit toolbar only; no post-save ack print).
 *
 * Do not import `sarfaesiCaseStatusUpdate.js` here — it pulls in MySQL and breaks the Next.js build.
 * PDF guides: README.md#sarfaesi-covering-sheet-pdfs
 */

import { useEffect, useMemo, useRef } from "react";
import { rowValueForField } from "../gridRowValue";
import { downloadBlobResponse } from "../fetchClientError";
import { apiUserMessage } from "../apiUserMessages";

const SARFAESI_CASE_STATUS_UPDATE_DETAILS_CHILD_KEY = "sarfaesi_case_status_update_details";

/** True when the current screen is SARFAESI Case Status Update. */
export function isSarfaesiCaseStatusUpdateModule(moduleKey) {
  return moduleKey === "sarfaesi_case_status_update";
}

/** Participates in the shared case-snapshot panel after Case No pick. */
export function isSarfaesiCaseStatusUpdateCaseSnapshotModule(moduleKey) {
  return isSarfaesiCaseStatusUpdateModule(moduleKey);
}

/** Label on the Print 13/2 Covering Sheet toolbar button. */
export function getSarfaesiCovering132PrintButtonText() {
  return "Print 13/2 Covering Sheet";
}

/** Label on the Print 13/2 Paper Publication toolbar button. */
export function getSarfaesiCovering132PaperPublicationPrintButtonText() {
  return "Print 13/2 Paper Publication";
}

/** Label on the Print 13(4) Covering Sheet toolbar button. */
export function getSarfaesiCovering134PrintButtonText() {
  return "Print 13(4) Covering Sheet";
}

/**
 * Record id for covering-sheet Print — selected row in view mode, or edit id in form mode.
 * Returns null when the button should be hidden.
 */
export function getSarfaesiCovering132PrintTargetId({
  moduleKey,
  canView,
  effectiveViewMode,
  selectedId,
  editingRowId
}) {
  if (!isSarfaesiCaseStatusUpdateModule(moduleKey) || !canView) return null;
  return effectiveViewMode ? selectedId : editingRowId ?? null;
}

/** Same visibility rules as covering sheet. */
export function getSarfaesiCovering132PaperPublicationPrintTargetId(args) {
  return getSarfaesiCovering132PrintTargetId(args);
}

/** Same visibility rules as 13/2 covering sheet. */
export function getSarfaesiCovering134PrintTargetId(args) {
  return getSarfaesiCovering132PrintTargetId(args);
}

/** Ref no hint for the downloaded PDF file name. */
export function sarfaesiCovering132RefHintFromRow(row) {
  return String(rowValueForField(row || {}, "refNo") ?? "").trim();
}

/**
 * Download 13(2) covering sheet PDF for a status-update record.
 * @param {number|string|null|undefined} recordId
 * @param {string} [refHint]
 */
export async function downloadSarfaesiCovering132Pdf(recordId, refHint) {
  if (recordId == null || String(recordId).trim() === "") return;
  const res = await fetch(`/api/sarfaesi-case-status-update/covering-132-pdf/${recordId}`);
  const fallbackName = refHint
    ? `COVERING_132_${String(refHint).replace(/\//g, "_")}.pdf`
    : "COVERING_132.pdf";
  await downloadBlobResponse(res, apiUserMessage("downloadPdf"), fallbackName);
}

/**
 * Download 13(2) paper publication covering sheet PDF.
 * @param {number|string|null|undefined} recordId
 * @param {string} [refHint]
 */
export async function downloadSarfaesiCovering132PaperPublicationPdf(recordId, refHint) {
  if (recordId == null || String(recordId).trim() === "") return;
  const res = await fetch(
    `/api/sarfaesi-case-status-update/covering-132-paper-publication-pdf/${recordId}`
  );
  const fallbackName = refHint
    ? `COVERING_132_PAPER_PUB_${String(refHint).replace(/\//g, "_")}.pdf`
    : "COVERING_132_PAPER_PUB.pdf";
  await downloadBlobResponse(res, apiUserMessage("downloadPdf"), fallbackName);
}

/**
 * Download 13(4) covering sheet PDF for a status-update record.
 * @param {number|string|null|undefined} recordId
 * @param {string} [refHint]
 */
export async function downloadSarfaesiCovering134Pdf(recordId, refHint) {
  if (recordId == null || String(recordId).trim() === "") return;
  const res = await fetch(`/api/sarfaesi-case-status-update/covering-134-pdf/${recordId}`);
  const fallbackName = refHint
    ? `COVERING_134_${String(refHint).replace(/\//g, "_")}.pdf`
    : "COVERING_134.pdf";
  await downloadBlobResponse(res, apiUserMessage("downloadPdf"), fallbackName);
}

/**
 * React hook: case picker LoV params + preload active particulars on new entry.
 * @param {{
 *   moduleKey: string,
 *   editingRow: object | null,
 *   formKey: string | number,
 *   childTables: object[],
 *   createDraftRow: Function,
 *   setChildRowsByKey: Function
 * }} props
 */
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
    // Case picker: SARFAESI loans only, excluding cases already on another status-update record.
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
    // New entry only: seed child grid with every active particular (remarks left blank).
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
          f_active: "Yes",
          lov: "1" // Users need not have sarfaesi_case_particulars module access
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
