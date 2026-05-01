// Module-specific file: contains business rules for this module only.
// Do not move this logic into generic/shared files.

import { useEffect, useState } from "react";
import { rowValueForField } from "../gridRowValue";
import { isPublicNoticeModule } from "./publicNoticeClient";
import { isReturnCaseModule } from "./returnCaseClient";
import { isTransferCaseSnapshotModule } from "./transferCaseClient";

/**
 * Shared case snapshot model used by Public Notice + Return Case.
 * Layman terms:
 * - These two modules pick a Case No and show a read-only case summary.
 * - This hook owns fetch/loading/modal/open-close state so generic screens stay clean.
 */
export function isCaseSnapshotModule(moduleKey) {
  return (
    isPublicNoticeModule(moduleKey) ||
    isReturnCaseModule(moduleKey) ||
    isTransferCaseSnapshotModule(moduleKey)
  );
}

function formatSnapshotInrTotal(value) {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  const amount = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(safe);
  return `₹ ${amount}`;
}

export function useCaseSnapshotModel({ moduleKey, editingRow }) {
  const enabled = isCaseSnapshotModule(moduleKey);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState(null);

  async function loadByCaseId(caseIdRaw) {
    const caseId = Number(caseIdRaw);
    if (!Number.isFinite(caseId) || caseId <= 0) {
      setPreview(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/crud/new_case_inward/${caseId}`);
      const payload = await res.json();
      if (!res.ok || !payload?.data) {
        setPreview(null);
        setLoading(false);
        return;
      }
      const d = payload.data;
      const recoveredLines = Array.isArray(payload.childTableRows?.amount_recovered)
        ? payload.childTableRows.amount_recovered
        : [];
      let totalRecovered = 0;
      for (const line of recoveredLines) {
        const amt = Number(rowValueForField(line, "recoveredAmount"));
        if (Number.isFinite(amt)) totalRecovered += amt;
      }
      const statusDateRaw = rowValueForField(d, "caseStatusUpdatedDate");
      const statusDateFmt = String(statusDateRaw ?? "").trim()
        ? String(statusDateRaw).slice(0, 10).split("-").reverse().join("-")
        : "";
      const statusDateDisplay = statusDateFmt && statusDateFmt !== "--" ? statusDateFmt : "—";
      setPreview({
        caseNo: String(rowValueForField(d, "caseNo") ?? "").trim(),
        borrower: String(rowValueForField(d, "borrower") ?? "").trim(),
        unit: String(rowValueForField(d, "unitLabel") ?? "").trim(),
        branch: String(rowValueForField(d, "branchLabel") ?? "").trim(),
        loanCategory: String(rowValueForField(d, "loanCategoryLabel") ?? "").trim(),
        loanType: String(rowValueForField(d, "loanTypeLabel") ?? "").trim(),
        status: String(rowValueForField(d, "caseStatusLabel") ?? "").trim(),
        caseStatusRemarks: String(rowValueForField(d, "caseStatusRemarks") ?? "").trim(),
        caseStatusUpdatedDateDisplay: statusDateDisplay,
        totalRecoveredDisplay: formatSnapshotInrTotal(totalRecovered)
      });
    } catch {
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!enabled) {
      setPreview(null);
      setLoading(false);
      setModalOpen(false);
      setSelectedCaseId(null);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (!editingRow) return;
    setSelectedCaseId(Number(editingRow?.caseNo) || null);
    void loadByCaseId(editingRow?.caseNo);
  }, [enabled, editingRow?.id]);

  function handleCaseFieldValueChange(fieldName, value) {
    if (!enabled) return false;
    if (fieldName !== "caseNo") return false;
    const caseId = Number(value);
    setSelectedCaseId(Number.isFinite(caseId) && caseId > 0 ? caseId : null);
    void loadByCaseId(value);
    return true;
  }

  function reset() {
    setPreview(null);
    setLoading(false);
    setModalOpen(false);
    setSelectedCaseId(null);
  }

  return {
    enabled,
    preview,
    loading,
    modalOpen,
    selectedCaseId,
    setModalOpen,
    handleCaseFieldValueChange,
    reset
  };
}
