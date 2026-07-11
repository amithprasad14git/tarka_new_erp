// Module-specific file: contains business rules for this module only.
// Do not move this logic into generic/shared files.

/**
 * ============================================================================
 * PUBLIC NOTICE (CLIENT-SIDE) MODULE FILE
 * ============================================================================
 * Layman summary:
 * - This file keeps Public Notice-specific browser behavior out of generic
 *   screens/components.
 * - It handles only front-end actions like PDF download naming and module checks.
 * - Server validations and DB logic stay in lib/modules/publicNotice.js.
 * ============================================================================
 */

import { rowValueForField } from "../gridRowValue";
import { useMemo } from "react";
import { downloadBlobResponse } from "../fetchClientError";
import { apiUserMessage } from "../apiUserMessages";

/** True when the current screen is Public Notice. */
export function isPublicNoticeModule(moduleKey) {
  return moduleKey === "public_notice";
}

/** Show post-save Print acknowledgement when editing an existing Public Notice. */
export function shouldShowPublicNoticeAckOnEdit(moduleKey, editingRow) {
  return isPublicNoticeModule(moduleKey) && Boolean(editingRow);
}

/** Ack dialog print mode key for Public Notice PDF. */
export function getPublicNoticeAckPrintMode() {
  return "publicNotice";
}

/** Label on the Print button in the post-save acknowledgement dialog. */
export function getPublicNoticeAckPrintLabel(configuredLabel) {
  return configuredLabel || "Print Public Notice";
}

/** Label on the Print toolbar button. */
export function getPublicNoticePrintButtonText() {
  return "Print Public Notice";
}

/**
 * React hook: Case No picker filters for Public Notice entry.
 * @param {{ moduleKey: string, editingRow: object | null }} props
 */
export function usePublicNoticeClientModel({ moduleKey, editingRow }) {
  // Case picker lists only cases eligible for public notice (server filter via LoV param).
  const entryFieldUiOverrides = useMemo(() => {
    if (!isPublicNoticeModule(moduleKey)) return null;
    const parentRecordId =
      editingRow?.id != null && String(editingRow.id).trim() !== "" ? String(editingRow.id) : "";
    return {
      caseNo: {
        lookup: {
          extraLovParams: {
            public_notice_case_picker: "1",
            ...(parentRecordId ? { public_notice_parent_id: parentRecordId } : {})
          }
        }
      }
    };
  }, [moduleKey, editingRow?.id]);

  return { entryFieldUiOverrides };
}

/**
 * Record id for Print — selected row in view mode, or current edit id in form mode.
 * @returns {number|string|null}
 */
export function getPublicNoticePrintTargetId({ moduleKey, canView, effectiveViewMode, selectedId, editingRowId }) {
  if (!isPublicNoticeModule(moduleKey) || !canView) return null;
  return effectiveViewMode ? selectedId : editingRowId ?? null;
}

/** Sanitize ref hint for a safe PDF download filename. */
function safeNoticeFilename(refHint) {
  const safeRef =
    String(refHint ?? "")
      .trim()
      .replace(/[^\w./-]+/g, "_")
      .slice(0, 80) || "NOTICE";
  return `PUBLIC_NOTICE_${safeRef}.pdf`;
}

/**
 * Fetch and download the Public Notice PDF for a record.
 * @param {number|string|null|undefined} recordId
 * @param {string} [refHint] — used in the download filename
 */
export async function downloadPublicNoticePdf(recordId, refHint) {
  if (recordId == null) return;
  const res = await fetch(`/api/public-notice/pdf/${recordId}`);
  await downloadBlobResponse(res, apiUserMessage("downloadPdf"), safeNoticeFilename(refHint));
}

/** Case / ref label used as a hint for the downloaded PDF file name. */
export function publicNoticeRefHintFromRow(row) {
  return (
    String(rowValueForField(row || {}, "caseNoLabel") ?? "").trim() ||
    String(rowValueForField(row || {}, "refNo") ?? "").trim()
  );
}


