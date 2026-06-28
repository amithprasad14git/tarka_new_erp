/**
 * vehicleInvoice — browser-only behaviour (forms, pickers, Print/download).
 * Server save rules: lib/modules/vehicleInvoice.js
 */

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

export function isVehicleInvoiceModule(moduleKey) {
  return moduleKey === "vehicle_invoice";
}

export function shouldShowVehicleInvoiceAckOnEdit(moduleKey, editingRow) {
  return isVehicleInvoiceModule(moduleKey) && Boolean(editingRow);
}

// --- PDF print (Vehicle Invoice) — wired in MasterModuleClient; see docs/vehicle-invoice-pdf.md ---

export function getVehicleInvoicePrintButtonText() {
  return "Print";
}

export function getVehicleInvoiceAckPrintLabel(configuredLabel) {
  return configuredLabel || "Print";
}

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

export function vehicleInvoiceRefHintFromRow(row) {
  return String(rowValueForField(row || {}, "invoiceNo") ?? "").trim();
}

/** Fetches GET /api/vehicle-invoice/pdf/:id and triggers browser download. See docs/vehicle-invoice-pdf.md. */
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

