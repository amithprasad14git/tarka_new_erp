// Recovery Invoice — client-only behaviour (dates, cancellation visibility, grand total, case picker params).

import { useCallback, useEffect, useMemo, useState } from "react";
import { rowValueForField } from "../gridRowValue";
import { getYmdISTFromInstant } from "../istDateTime";
import { downloadBlobResponse } from "../fetchClientError";
import { apiUserMessage } from "../apiUserMessages";
import { handleInvoiceCaseNoNpaAutoFill } from "./invoiceNpaCurrentAcClient";

/** Must match `childTables[].key` in config/modules.js */
const RECOVERY_CHARGES_CHILD_KEY = "recovery_charges";

function sumRecoveryInvoiceChargesAmount(childTableRows) {
  const rows = Array.isArray(childTableRows?.[RECOVERY_CHARGES_CHILD_KEY])
    ? childTableRows[RECOVERY_CHARGES_CHILD_KEY]
    : [];
  let sum = 0;
  for (const row of rows) {
    const n = Number(rowValueForField(row || {}, "amount"));
    if (Number.isFinite(n)) sum += n;
  }
  return Math.round(sum * 100) / 100;
}

function formatRecoveryInvoiceGrandTotalInr(n) {
  const safe = Number.isFinite(n) ? n : 0;
  const amount = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(safe);
  return `₹ ${amount}`;
}

/** True when the current screen is Recovery Invoice. */
export function isRecoveryInvoiceModule(moduleKey) {
  return moduleKey === "recovery_invoice";
}

/**
 * Grid status dot: cancelled vs already linked to Invoices Received vs pending.
 * @param {object} row
 * @returns {"cancelled"|"received"|"pending"}
 */
export function getRecoveryInvoiceDotTone(row) {
  const cancelled = String(rowValueForField(row, "cancelledInvoice") ?? "No")
    .trim()
    .toLowerCase();
  if (cancelled === "yes") return "cancelled";
  if (row?._hasInvoicesReceived === true) return "received";
  return "pending";
}

/** Tooltip / aria label for the status dot tone. */
export function recoveryInvoiceDotLabel(tone) {
  if (tone === "cancelled") return "Cancelled invoice";
  if (tone === "received") return "Received invoice";
  return "Pending invoice";
}

/** Show post-save Print acknowledgement when editing an existing Recovery Invoice. */
export function shouldShowRecoveryInvoiceAckOnEdit(moduleKey, editingRow) {
  return isRecoveryInvoiceModule(moduleKey) && Boolean(editingRow);
}

// --- PDF print (Recovery Invoice) — wired in MasterModuleClient; see README.md#recovery-invoice-pdf ---

/** Label on the Print toolbar button. */
export function getRecoveryInvoicePrintButtonText() {
  return "Print";
}

/** Label on the Print button in the post-save acknowledgement dialog. */
export function getRecoveryInvoiceAckPrintLabel(configuredLabel) {
  return configuredLabel || "Print";
}

/**
 * Record id for Print — selected row in view mode, or current edit id in form mode.
 * @returns {number|string|null}
 */
export function getRecoveryInvoicePrintTargetId({
  moduleKey,
  canView,
  effectiveViewMode,
  selectedId,
  editingRowId
}) {
  if (!isRecoveryInvoiceModule(moduleKey) || !canView) return null;
  return effectiveViewMode ? selectedId : editingRowId ?? null;
}

/** Invoice no used as a hint for the downloaded PDF file name. */
export function recoveryInvoiceRefHintFromRow(row) {
  return String(rowValueForField(row || {}, "invoiceNo") ?? "").trim();
}

/** Fetches GET /api/recovery-invoice/pdf/:id and triggers browser download. See README.md#recovery-invoice-pdf. */
export async function downloadRecoveryInvoicePdf(recordId, refHint) {
  if (recordId == null) return;
  const res = await fetch(`/api/recovery-invoice/pdf/${recordId}`);
  const fallbackName =
    refHint ? `Invoice_${String(refHint).replace(/\//g, "_")}.pdf` : "Invoice.pdf";
  await downloadBlobResponse(res, apiUserMessage("downloadPdf"), fallbackName);
}

/** New entry: default Date to today (IST); readonly in UI via entryReadOnlyFields. */
export function mergeRecoveryInvoiceEntryInitialValues(moduleKey, editingRow, values) {
  if (!isRecoveryInvoiceModule(moduleKey) || editingRow) return values;
  const today = getYmdISTFromInstant(new Date());
  if (!today) return values;
  const existing = values.date != null ? String(values.date).trim() : "";
  const cancelled =
    values.cancelledInvoice != null && String(values.cancelledInvoice).trim() !== ""
      ? String(values.cancelledInvoice).trim()
      : "No";
  return { ...values, date: existing || today, cancelledInvoice: cancelled, finalInvoice: "Yes" };
}

/**
 * Entry form config: hide `grandTotal` from the main DynamicForm (shown below charges grid in MasterModuleClient).
 * Toggle `cancellationReason` when Cancelled Invoice is not Yes.
 */
export function getRecoveryInvoiceEntryModeConfig(moduleKey, config, cancelledInvoiceDraft) {
  if (!config || !isRecoveryInvoiceModule(moduleKey)) return config;
  const cancelled = String(cancelledInvoiceDraft ?? "No").trim().toLowerCase() === "yes";
  const baseFields = config.fields || [];
  const fields = baseFields.filter((f) => {
    if (f.name === "grandTotal") return false;
    if (f.name === "cancellationReason" && !cancelled) return false;
    return true;
  });
  return { ...config, fields };
}

/**
 * Client-side cancel / Bill-to-Unit rules before submit (server re-validates).
 * Without Case No, Bill to Unit and NPA Current AC are required.
 * @param {object} body
 * @returns {string | null} error message, or null when ok
 */
export function validateRecoveryInvoiceClientSubmit(body) {
  const cancelled = String(body?.cancelledInvoice ?? "No").trim().toLowerCase() === "yes";
  if (cancelled) {
    const reason = String(body?.cancellationReason ?? "").trim();
    if (!reason) {
      return "Cancellation Reason is required when Cancelled Invoice is Yes.";
    }
  }
  const caseId = Number(body?.caseNo);
  const hasCase = Number.isFinite(caseId) && caseId > 0;
  if (!hasCase) {
    const billToUnit = Number(body?.billToUnit);
    const npaCurrentAc = Number(body?.npaCurrentAc);
    const hasBillTo = Number.isFinite(billToUnit) && billToUnit > 0;
    const hasNpa = Number.isFinite(npaCurrentAc) && npaCurrentAc > 0;
    if (!hasBillTo || !hasNpa) {
      return "Bill to Unit and NPA Current AC are required when Case No is not selected.";
    }
  }
  return null;
}

/**
 * React hook: cancellation visibility, live grand total, case picker, NPA auto-fill.
 * @param {{
 *   moduleKey: string,
 *   config: object,
 *   editingRow: object | null,
 *   formKey: string | number,
 *   childRowsByKey: Record<string, Array<Record<string, unknown>>>,
 * }} props
 */
export function useRecoveryInvoiceClientModel({ moduleKey, config, editingRow, formKey, childRowsByKey }) {
  // Tracks cancellation flag, live grand total from charge lines, case picker params, and NPA auto-fill.
  const [cancelledInvoiceDraft, setCancelledInvoiceDraft] = useState("No");
  const [autoValues, setAutoValues] = useState({});

  useEffect(() => {
    if (!isRecoveryInvoiceModule(moduleKey)) {
      setCancelledInvoiceDraft("No");
      setAutoValues({});
      return;
    }
    setAutoValues({});
  }, [moduleKey, editingRow, formKey]);

  useEffect(() => {
    if (!isRecoveryInvoiceModule(moduleKey)) {
      setCancelledInvoiceDraft("No");
      return;
    }
    const v = editingRow?.cancelledInvoice ?? "No";
    setCancelledInvoiceDraft(String(v).trim() === "Yes" ? "Yes" : "No");
  }, [moduleKey, editingRow?.id, editingRow?.cancelledInvoice]);

  const entryModeConfig = useMemo(() => {
    if (!isRecoveryInvoiceModule(moduleKey) || !config) return null;
    return getRecoveryInvoiceEntryModeConfig(moduleKey, config, cancelledInvoiceDraft);
  }, [moduleKey, config, cancelledInvoiceDraft]);

  const entryReadOnlyFields = useMemo(() => {
    if (!isRecoveryInvoiceModule(moduleKey)) return null;
    return { date: true };
  }, [moduleKey]);

  const entryFieldUiOverrides = useMemo(() => {
    if (!isRecoveryInvoiceModule(moduleKey)) return null;
    const cancelled = cancelledInvoiceDraft === "Yes";
    return {
      caseNo: {
        lookup: {
          extraLovParams: { recovery_invoice_case_picker: "1" }
        }
      },
      cancellationReason: cancelled
        ? { helperText: "Required when invoice is cancelled." }
        : undefined
    };
  }, [moduleKey, cancelledInvoiceDraft]);

  const grandTotalDisplay = useMemo(() => {
    if (!isRecoveryInvoiceModule(moduleKey)) return "";
    const n = sumRecoveryInvoiceChargesAmount({
      [RECOVERY_CHARGES_CHILD_KEY]: childRowsByKey?.[RECOVERY_CHARGES_CHILD_KEY]
    });
    return formatRecoveryInvoiceGrandTotalInr(n);
  }, [moduleKey, childRowsByKey]);

  const handleFieldValueChange = useCallback(
    (fieldName, value) => {
      if (!isRecoveryInvoiceModule(moduleKey)) return false;
      if (fieldName === "cancelledInvoice") {
        setCancelledInvoiceDraft(String(value ?? "").trim() === "Yes" ? "Yes" : "No");
        return false;
      }
      if (handleInvoiceCaseNoNpaAutoFill(fieldName, value, setAutoValues)) return true;
      return false;
    },
    [moduleKey]
  );

  function mergeSubmitBody(body) {
    if (!isRecoveryInvoiceModule(moduleKey)) return body;
    const total = sumRecoveryInvoiceChargesAmount({
      [RECOVERY_CHARGES_CHILD_KEY]: body?.childTableRows?.[RECOVERY_CHARGES_CHILD_KEY]
    });
    return { ...body, grandTotal: total };
  }

  return {
    autoValues,
    entryModeConfig,
    entryReadOnlyFields,
    entryFieldUiOverrides,
    handleFieldValueChange,
    grandTotalDisplay,
    mergeSubmitBody
  };
}

