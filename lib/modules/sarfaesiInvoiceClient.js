/**
 * sarfaesiInvoice — browser-only behaviour (forms, pickers, Print/download).
 * Server save rules: lib/modules/sarfaesiInvoice.js
 */

// SARFAESI Invoice — client-only behaviour (dates, cancellation visibility, grand total, case picker params).
// Wire in MasterModuleClient / case snapshot same as recovery_invoice when ready.

import { useCallback, useEffect, useMemo, useState } from "react";
import { rowValueForField } from "../gridRowValue";
import { getYmdISTFromInstant } from "../istDateTime";
import { downloadBlobResponse } from "../fetchClientError";
import { apiUserMessage } from "../apiUserMessages";
import { handleInvoiceCaseNoNpaAutoFill } from "./invoiceNpaCurrentAcClient";

/** Must match `childTables[].key` for sarfaesi_invoice in config/modules.js (avoid importing server module in client bundle). */
const SARFAESI_CHARGES_CHILD_KEY = "sarfaesi_charges";

function sumSarfaesiInvoiceChargesAmount(childTableRows) {
  const rows = Array.isArray(childTableRows?.[SARFAESI_CHARGES_CHILD_KEY])
    ? childTableRows[SARFAESI_CHARGES_CHILD_KEY]
    : [];
  let sum = 0;
  for (const row of rows) {
    const n = Number(rowValueForField(row || {}, "amount"));
    if (Number.isFinite(n)) sum += n;
  }
  return Math.round(sum * 100) / 100;
}

function formatSarfaesiInvoiceGrandTotalInr(n) {
  const safe = Number.isFinite(n) ? n : 0;
  const amount = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(safe);
  return `₹ ${amount}`;
}

export function isSarfaesiInvoiceModule(moduleKey) {
  return moduleKey === "sarfaesi_invoice";
}

export function shouldShowSarfaesiInvoiceAckOnEdit(moduleKey, editingRow) {
  return isSarfaesiInvoiceModule(moduleKey) && Boolean(editingRow);
}

// --- PDF print (SARFAESI Invoice) — wired in MasterModuleClient; see docs/sarfaesi-invoice-pdf.md ---

export function getSarfaesiInvoicePrintButtonText() {
  return "Print";
}

export function getSarfaesiInvoiceAckPrintLabel(configuredLabel) {
  return configuredLabel || "Print";
}

export function getSarfaesiInvoicePrintTargetId({
  moduleKey,
  canView,
  effectiveViewMode,
  selectedId,
  editingRowId
}) {
  if (!isSarfaesiInvoiceModule(moduleKey) || !canView) return null;
  return effectiveViewMode ? selectedId : editingRowId ?? null;
}

export function sarfaesiInvoiceRefHintFromRow(row) {
  return String(rowValueForField(row || {}, "invoiceNo") ?? "").trim();
}

/** Fetches GET /api/sarfaesi-invoice/pdf/:id and triggers browser download. See docs/sarfaesi-invoice-pdf.md. */
export async function downloadSarfaesiInvoicePdf(recordId, refHint) {
  if (recordId == null) return;
  const res = await fetch(`/api/sarfaesi-invoice/pdf/${recordId}`);
  const fallbackName =
    refHint ? `Invoice_${String(refHint).replace(/\//g, "_")}.pdf` : "Invoice.pdf";
  await downloadBlobResponse(res, apiUserMessage("downloadPdf"), fallbackName);
}

/** LoV flag for Case No picker — must match `SARFAESI_INVOICE_CASE_PICKER_LOV_PARAM` in sarfaesiInvoice.js. */
export const SARFAESI_INVOICE_CASE_PICKER_LOV_PARAM = "sarfaesi_invoice_case_picker";

/** Passed to `new_case_inward` list API; server filters to Loan Category = SARFAESI. */
export function getSarfaesiInvoiceCaseNoLookupExtraLovParams() {
  return { [SARFAESI_INVOICE_CASE_PICKER_LOV_PARAM]: "1" };
}

/** New entry: default Date to today (IST); readonly in UI via entryReadOnlyFields. */
export function mergeSarfaesiInvoiceEntryInitialValues(moduleKey, editingRow, values) {
  if (!isSarfaesiInvoiceModule(moduleKey) || editingRow) return values;
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
 * Entry form config: hide `grandTotal` from the main DynamicForm (shown below charges grid).
 * Toggle `cancellationReason` when Cancelled Invoice is not Yes.
 */
export function getSarfaesiInvoiceEntryModeConfig(moduleKey, config, cancelledInvoiceDraft) {
  if (!config || !isSarfaesiInvoiceModule(moduleKey)) return config;
  const cancelled = String(cancelledInvoiceDraft ?? "No").trim().toLowerCase() === "yes";
  const baseFields = config.fields || [];
  const fields = baseFields.filter((f) => {
    if (f.name === "grandTotal") return false;
    if (f.name === "cancellationReason" && !cancelled) return false;
    return true;
  });
  return { ...config, fields };
}

export function validateSarfaesiInvoiceClientSubmit(body) {
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
 *   formKey: string | number,
 *   childRowsByKey: Record<string, Array<Record<string, unknown>>>,
 * }} props
 */
export function useSarfaesiInvoiceClientModel({ moduleKey, config, editingRow, formKey, childRowsByKey }) {
  const [cancelledInvoiceDraft, setCancelledInvoiceDraft] = useState("No");
  const [autoValues, setAutoValues] = useState({});

  useEffect(() => {
    if (!isSarfaesiInvoiceModule(moduleKey)) {
      setCancelledInvoiceDraft("No");
      setAutoValues({});
      return;
    }
    setAutoValues({});
  }, [moduleKey, editingRow, formKey]);

  useEffect(() => {
    if (!isSarfaesiInvoiceModule(moduleKey)) {
      setCancelledInvoiceDraft("No");
      return;
    }
    const v = editingRow?.cancelledInvoice ?? "No";
    setCancelledInvoiceDraft(String(v).trim() === "Yes" ? "Yes" : "No");
  }, [moduleKey, editingRow?.id, editingRow?.cancelledInvoice]);

  const entryModeConfig = useMemo(() => {
    if (!isSarfaesiInvoiceModule(moduleKey) || !config) return null;
    return getSarfaesiInvoiceEntryModeConfig(moduleKey, config, cancelledInvoiceDraft);
  }, [moduleKey, config, cancelledInvoiceDraft]);

  const entryReadOnlyFields = useMemo(() => {
    if (!isSarfaesiInvoiceModule(moduleKey)) return null;
    return { date: true };
  }, [moduleKey]);

  const entryFieldUiOverrides = useMemo(() => {
    if (!isSarfaesiInvoiceModule(moduleKey)) return null;
    const cancelled = cancelledInvoiceDraft === "Yes";
    return {
      caseNo: {
        lookup: {
          extraLovParams: getSarfaesiInvoiceCaseNoLookupExtraLovParams()
        }
      },
      cancellationReason: cancelled ? { helperText: "Required when invoice is cancelled." } : undefined
    };
  }, [moduleKey, cancelledInvoiceDraft]);

  const grandTotalDisplay = useMemo(() => {
    if (!isSarfaesiInvoiceModule(moduleKey)) return "";
    const n = sumSarfaesiInvoiceChargesAmount({
      [SARFAESI_CHARGES_CHILD_KEY]: childRowsByKey?.[SARFAESI_CHARGES_CHILD_KEY]
    });
    return formatSarfaesiInvoiceGrandTotalInr(n);
  }, [moduleKey, childRowsByKey]);

  const handleFieldValueChange = useCallback(
    (fieldName, value) => {
      if (!isSarfaesiInvoiceModule(moduleKey)) return false;
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
    if (!isSarfaesiInvoiceModule(moduleKey)) return body;
    const total = sumSarfaesiInvoiceChargesAmount({
      [SARFAESI_CHARGES_CHILD_KEY]: body?.childTableRows?.[SARFAESI_CHARGES_CHILD_KEY]
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

