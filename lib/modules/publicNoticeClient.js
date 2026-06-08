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

export function isPublicNoticeModule(moduleKey) {
  return moduleKey === "public_notice";
}

export function shouldShowPublicNoticeAckOnEdit(moduleKey, editingRow) {
  return isPublicNoticeModule(moduleKey) && Boolean(editingRow);
}

export function getPublicNoticeAckPrintMode() {
  return "publicNotice";
}

export function getPublicNoticeAckPrintLabel(configuredLabel) {
  return configuredLabel || "Print Public Notice";
}

export function getPublicNoticePrintButtonText() {
  return "Print Public Notice";
}

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

export function getPublicNoticePrintTargetId({ moduleKey, canView, effectiveViewMode, selectedId, editingRowId }) {
  if (!isPublicNoticeModule(moduleKey) || !canView) return null;
  return effectiveViewMode ? selectedId : editingRowId ?? null;
}

function safeNoticeFilename(refHint) {
  const safeRef =
    String(refHint ?? "")
      .trim()
      .replace(/[^\w./-]+/g, "_")
      .slice(0, 80) || "NOTICE";
  return `PUBLIC_NOTICE_${safeRef}.pdf`;
}

export async function downloadPublicNoticePdf(recordId, refHint) {
  if (recordId == null) return;
  const res = await fetch(`/api/public-notice/pdf/${recordId}`);
  await downloadBlobResponse(res, apiUserMessage("downloadPdf"), safeNoticeFilename(refHint));
}

export function publicNoticeRefHintFromRow(row) {
  return (
    String(rowValueForField(row || {}, "caseNoLabel") ?? "").trim() ||
    String(rowValueForField(row || {}, "refNo") ?? "").trim()
  );
}

