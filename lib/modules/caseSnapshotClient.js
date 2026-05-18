// Module-specific file: contains business rules for this module only.
// Do not move this logic into generic/shared files.

import { useEffect, useState } from "react";
import { modules } from "../../config/modules";
import { isPublicNoticeModule } from "./publicNoticeClient";
import { isReturnCaseModule } from "./returnCaseClient";
import { isTransferCaseSnapshotModule } from "./transferCaseClient";
import { isRecoveryInvoiceModule } from "./recoveryInvoiceClient";
import { isSarfaesiInvoiceModule } from "./sarfaesiInvoiceClient";
import { isVehicleInvoiceModule } from "./vehicleInvoiceClient";
import { isSarfaesiCaseStatusUpdateCaseSnapshotModule } from "./sarfaesiCaseStatusUpdateClient";
import { buildNciReadonlyModalDetail } from "./newCaseInwardClient";

/**
 * Shared case snapshot model used by modules that pick a Case No and show a read-only case summary.
 */
export function isCaseSnapshotModule(moduleKey) {
  return (
    isPublicNoticeModule(moduleKey) ||
    isReturnCaseModule(moduleKey) ||
    isTransferCaseSnapshotModule(moduleKey) ||
    isRecoveryInvoiceModule(moduleKey) ||
    isSarfaesiInvoiceModule(moduleKey) ||
    isVehicleInvoiceModule(moduleKey) ||
    isSarfaesiCaseStatusUpdateCaseSnapshotModule(moduleKey)
  );
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
      const detail = buildNciReadonlyModalDetail(payload, modules.new_case_inward);
      setPreview(detail ? { detail } : null);
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
