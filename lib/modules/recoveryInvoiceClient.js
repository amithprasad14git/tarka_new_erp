/**
 * recoveryInvoice — browser-only behaviour (forms, pickers, Print/download).
 * Server save rules: lib/modules/recoveryInvoice.js
 */

// Recovery Invoice — client-only behaviour (dates, cancellation visibility, grand total, case picker params).

import { useCallback, useEffect, useMemo, useState } from "react";
import { rowValueForField } from "../gridRowValue";
import { getYmdISTFromInstant } from "../istDateTime";

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

export function isRecoveryInvoiceModule(moduleKey) {
  return moduleKey === "recovery_invoice";
}

export function shouldShowRecoveryInvoiceAckOnEdit(moduleKey, editingRow) {
  return isRecoveryInvoiceModule(moduleKey) && Boolean(editingRow);
}

// --- PDF print (Recovery Invoice) — wired in MasterModuleClient; see docs/recovery-invoice-pdf.md ---

export function getRecoveryInvoicePrintButtonText() {
  return "Print";
}

export function getRecoveryInvoiceAckPrintLabel(configuredLabel) {
  return configuredLabel || "Print";
}

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

export function recoveryInvoiceRefHintFromRow(row) {
  return String(rowValueForField(row || {}, "invoiceNo") ?? "").trim();
}

function contentDispositionFilename(headerValue) {
  const cd = String(headerValue || "").trim();
  if (!cd) return "";
  const m = cd.match(/filename="([^"]+)"/i) || cd.match(/filename\*=UTF-8''([^;\s]+)/i);
  if (!m) return "";
  try {
    return decodeURIComponent(String(m[1]).replace(/"/g, ""));
  } catch {
    return String(m[1]).replace(/"/g, "");
  }
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Fetches GET /api/recovery-invoice/pdf/:id and triggers browser download. See docs/recovery-invoice-pdf.md. */
export async function downloadRecoveryInvoicePdf(recordId, refHint) {
  if (recordId == null) return;
  const res = await fetch(`/api/recovery-invoice/pdf/${recordId}`);
  const blob = await res.blob();
  if (!res.ok) {
    let msg = "Failed to download PDF";
    try {
      const j = JSON.parse(await blob.text());
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const name =
    contentDispositionFilename(res.headers.get("Content-Disposition")) ||
    (refHint ? `Invoice_${String(refHint).replace(/\//g, "_")}.pdf` : "Invoice.pdf");
  triggerBlobDownload(blob, name);
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

export function validateRecoveryInvoiceClientSubmit(body) {
  const cancelled = String(body?.cancelledInvoice ?? "No").trim().toLowerCase() === "yes";
  if (cancelled) {
    const reason = String(body?.cancellationReason ?? "").trim();
    if (!reason) {
      return "Cancellation Reason is required when Cancelled Invoice is Yes.";
    }
  }
  return null;
}

/**
 * @param {{
 *   moduleKey: string,
 *   config: object,
 *   editingRow: object | null,
 *   childRowsByKey: Record<string, Array<Record<string, unknown>>>,
 * }} props
 */
export function useRecoveryInvoiceClientModel({ moduleKey, config, editingRow, childRowsByKey }) {
  // Tracks cancellation flag, live grand total from charge lines, and SARFAESI-filtered case picker params.
  const [cancelledInvoiceDraft, setCancelledInvoiceDraft] = useState("No");

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
    entryModeConfig,
    entryReadOnlyFields,
    entryFieldUiOverrides,
    handleFieldValueChange,
    grandTotalDisplay,
    mergeSubmitBody
  };
}

