/**
 * =============================================================================
 * CASE SNAPSHOT (CLIENT) — Read-only New Case Inward summary after Case No pick
 * =============================================================================
 * Modules that pick a Case No (Public Notice, Return Case, Transfer, invoices,
 * SARFAESI status update) show a read-only case summary modal. This hook loads
 * that snapshot when Case No changes and keeps modal state out of generic UI.
 * =============================================================================
 */

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
 * True when this module shows a read-only case summary after Case No is picked.
 * @param {string} moduleKey
 * @returns {boolean}
 */
export function isCaseSnapshotModule(moduleKey) {
  // Modules that show a read-only New Case Inward summary after Case No is picked.
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

/** Invoice modules use `/api/invoice/case-snapshot`; others load NCI CRUD get-by-id. */
function usesInvoiceCaseSnapshotApi(moduleKey) {
  return (
    isRecoveryInvoiceModule(moduleKey) ||
    isSarfaesiInvoiceModule(moduleKey) ||
    isVehicleInvoiceModule(moduleKey)
  );
}

/**
 * React hook: load/preview case snapshot when Case No changes on entry forms.
 * @param {{ moduleKey: string, editingRow: object | null }} props
 */
export function useCaseSnapshotModel({ moduleKey, editingRow }) {
  const enabled = isCaseSnapshotModule(moduleKey);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState(null);

  async function loadByCaseId(caseIdRaw) {
    // Read-only NCI fetch — same summary modal as other case-picker modules.
    const caseId = Number(caseIdRaw);
    if (!Number.isFinite(caseId) || caseId <= 0) {
      setPreview(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const url = usesInvoiceCaseSnapshotApi(moduleKey)
        ? `/api/invoice/case-snapshot/${caseId}`
        : `/api/crud/new_case_inward/${caseId}`;
      const res = await fetch(url);
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
    // MasterModuleClient calls this when Case No changes — refresh snapshot panel.
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

