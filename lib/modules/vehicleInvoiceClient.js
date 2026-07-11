// Vehicle Invoice — client-only behaviour (dates, cancellation visibility, grand total, case picker params).

import { useCallback, useEffect, useMemo, useState } from "react";
import { rowValueForField } from "../gridRowValue";
import { getYmdISTFromInstant } from "../istDateTime";
import { downloadBlobResponse } from "../fetchClientError";
import { apiUserMessage } from "../apiUserMessages";
import { handleInvoiceCaseNoNpaAutoFill } from "./invoiceNpaCurrentAcClient";

/** Must match `childTables[].key` in config/modules.js (avoid importing server module in client bundle). */
const VEHICLE_CHARGES_CHILD_KEY = "vehicle_charges";

function sumVehicleInvoiceChargesAmount(childTableRows) {
  const rows = Array.isArray(childTableRows?.[VEHICLE_CHARGES_CHILD_KEY])
    ? childTableRows[VEHICLE_CHARGES_CHILD_KEY]
    : [];
  let sum = 0;
  for (const row of rows) {
    const n = Number(rowValueForField(row || {}, "amount"));
    if (Number.isFinite(n)) sum += n;
  }
  return Math.round(sum * 100) / 100;
}

function formatVehicleInvoiceGrandTotalInr(n) {
  const safe = Number.isFinite(n) ? n : 0;
  const amount = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(safe);
  return `₹ ${amount}`;
}

/** True when the current screen is Vehicle Invoice. */
export function isVehicleInvoiceModule(moduleKey) {
  return moduleKey === "vehicle_invoice";
}

/**
 * Grid status dot: cancelled vs already linked to Invoices Received vs pending.
 * @param {object} row
 * @returns {"cancelled"|"received"|"pending"}
 */
export function getVehicleInvoiceDotTone(row) {
  const cancelled = String(rowValueForField(row, "cancelledInvoice") ?? "No")
    .trim()
    .toLowerCase();
  if (cancelled === "yes") return "cancelled";
  if (row?._hasInvoicesReceived === true) return "received";
  return "pending";
}

/** Tooltip / aria label for the status dot tone. */
export function vehicleInvoiceDotLabel(tone) {
  if (tone === "cancelled") return "Cancelled invoice";
  if (tone === "received") return "Received invoice";
  return "Pending invoice";
}

/** Show post-save Print acknowledgement when editing an existing Vehicle Invoice. */
export function shouldShowVehicleInvoiceAckOnEdit(moduleKey, editingRow) {
  return isVehicleInvoiceModule(moduleKey) && Boolean(editingRow);
}

// --- PDF print (Vehicle Invoice) — wired in MasterModuleClient; see README.md#vehicle-invoice-pdf ---

/** Label on the Print toolbar button. */
export function getVehicleInvoicePrintButtonText() {
  return "Print";
}

/** Label on the Print button in the post-save acknowledgement dialog. */
export function getVehicleInvoiceAckPrintLabel(configuredLabel) {
  return configuredLabel || "Print";
}

/**
 * Record id for Print — selected row in view mode, or current edit id in form mode.
 * @returns {number|string|null}
 */
export function getVehicleInvoicePrintTargetId({
  moduleKey,
  canView,
  effectiveViewMode,
  selectedId,
  editingRowId
}) {
  if (!isVehicleInvoiceModule(moduleKey) || !canView) return null;
  return effectiveViewMode ? selectedId : editingRowId ?? null;
}

/** Invoice no used as a hint for the downloaded PDF file name. */
export function vehicleInvoiceRefHintFromRow(row) {
  return String(rowValueForField(row || {}, "invoiceNo") ?? "").trim();
}

/** Fetches GET /api/vehicle-invoice/pdf/:id and triggers browser download. See README.md#vehicle-invoice-pdf. */
export async function downloadVehicleInvoicePdf(recordId, refHint) {
  if (recordId == null) return;
  const res = await fetch(`/api/vehicle-invoice/pdf/${recordId}`);
  const fallbackName =
    refHint ? `Invoice_${String(refHint).replace(/\//g, "_")}.pdf` : "Invoice.pdf";
  await downloadBlobResponse(res, apiUserMessage("downloadPdf"), fallbackName);
}

/** LoV flag for Case No picker — must match `VEHICLE_INVOICE_CASE_PICKER_LOV_PARAM` in vehicleInvoice.js. */
export const VEHICLE_INVOICE_CASE_PICKER_LOV_PARAM = "vehicle_invoice_case_picker";

/** Passed to `new_case_inward` list API; server filters to Loan Category = Vehicle Loan. */
export function getVehicleInvoiceCaseNoLookupExtraLovParams() {
  return { [VEHICLE_INVOICE_CASE_PICKER_LOV_PARAM]: "1" };
}

/** New entry: default Date to today (IST); readonly in UI via entryReadOnlyFields. */
export function mergeVehicleInvoiceEntryInitialValues(moduleKey, editingRow, values) {
  if (!isVehicleInvoiceModule(moduleKey) || editingRow) return values;
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
export function getVehicleInvoiceEntryModeConfig(moduleKey, config, cancelledInvoiceDraft) {
  if (!config || !isVehicleInvoiceModule(moduleKey)) return config;
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
 * Client-side cancel reason check before submit (server re-validates).
 * @param {object} body
 * @returns {string | null} error message, or null when ok
 */
export function validateVehicleInvoiceClientSubmit(body) {
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
 * React hook: cancellation visibility, live grand total, case picker, NPA auto-fill.
 * @param {{
 *   moduleKey: string,
 *   config: object,
 *   editingRow: object | null,
 *   formKey: string | number,
 *   childRowsByKey: Record<string, Array<Record<string, unknown>>>,
 * }} props
 */
export function useVehicleInvoiceClientModel({ moduleKey, config, editingRow, formKey, childRowsByKey }) {
  const [cancelledInvoiceDraft, setCancelledInvoiceDraft] = useState("No");
  const [autoValues, setAutoValues] = useState({});

  useEffect(() => {
    if (!isVehicleInvoiceModule(moduleKey)) {
      setCancelledInvoiceDraft("No");
      setAutoValues({});
      return;
    }
    setAutoValues({});
  }, [moduleKey, editingRow, formKey]);

  useEffect(() => {
    if (!isVehicleInvoiceModule(moduleKey)) {
      setCancelledInvoiceDraft("No");
      return;
    }
    const v = editingRow?.cancelledInvoice ?? "No";
    setCancelledInvoiceDraft(String(v).trim() === "Yes" ? "Yes" : "No");
  }, [moduleKey, editingRow?.id, editingRow?.cancelledInvoice]);

  const entryModeConfig = useMemo(() => {
    if (!isVehicleInvoiceModule(moduleKey) || !config) return null;
    return getVehicleInvoiceEntryModeConfig(moduleKey, config, cancelledInvoiceDraft);
  }, [moduleKey, config, cancelledInvoiceDraft]);

  const entryReadOnlyFields = useMemo(() => {
    if (!isVehicleInvoiceModule(moduleKey)) return null;
    return { date: true };
  }, [moduleKey]);

  const entryFieldUiOverrides = useMemo(() => {
    if (!isVehicleInvoiceModule(moduleKey)) return null;
    const cancelled = cancelledInvoiceDraft === "Yes";
    return {
      caseNo: {
        lookup: {
          extraLovParams: getVehicleInvoiceCaseNoLookupExtraLovParams()
        }
      },
      cancellationReason: cancelled ? { helperText: "Required when invoice is cancelled." } : undefined
    };
  }, [moduleKey, cancelledInvoiceDraft]);

  const grandTotalDisplay = useMemo(() => {
    if (!isVehicleInvoiceModule(moduleKey)) return "";
    const n = sumVehicleInvoiceChargesAmount({
      [VEHICLE_CHARGES_CHILD_KEY]: childRowsByKey?.[VEHICLE_CHARGES_CHILD_KEY]
    });
    return formatVehicleInvoiceGrandTotalInr(n);
  }, [moduleKey, childRowsByKey]);

  const handleFieldValueChange = useCallback(
    (fieldName, value) => {
      if (!isVehicleInvoiceModule(moduleKey)) return false;
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
    if (!isVehicleInvoiceModule(moduleKey)) return body;
    // Recompute grand total on submit so server and UI always match charge lines.
    const total = sumVehicleInvoiceChargesAmount({
      [VEHICLE_CHARGES_CHILD_KEY]: body?.childTableRows?.[VEHICLE_CHARGES_CHILD_KEY]
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

