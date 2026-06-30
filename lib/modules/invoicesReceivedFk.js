/**
 * Invoices Received — pure invoice FK helpers (no React).
 * Shared by invoicesReceivedClient.js and Jest.
 */

export const INVOICES_RECEIVED_INVOICE_FK_FIELDS = [
  "recoveryInvoice",
  "sarfaesiInvoice",
  "vehicleInvoice"
];

/** Positive invoice FK id as string, or "" when unset / legacy 0. */
export function normalizeInvoiceFkId(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? String(n) : "";
}

function invoiceLookupLabelKey(fieldName) {
  return `${fieldName}Label`;
}

/**
 * @param {Record<string, unknown>|null|undefined} row
 */
export function buildInvoicesReceivedDraftFromRow(row) {
  if (!row) {
    return {
      recoveryInvoice: "",
      sarfaesiInvoice: "",
      vehicleInvoice: "",
      recoveryInvoiceLabel: "",
      sarfaesiInvoiceLabel: "",
      vehicleInvoiceLabel: ""
    };
  }
  const recoveryInvoice = normalizeInvoiceFkId(row.recoveryInvoice);
  const sarfaesiInvoice = normalizeInvoiceFkId(row.sarfaesiInvoice);
  const vehicleInvoice = normalizeInvoiceFkId(row.vehicleInvoice);
  return {
    recoveryInvoice,
    sarfaesiInvoice,
    vehicleInvoice,
    recoveryInvoiceLabel:
      recoveryInvoice && row.recoveryInvoiceLabel != null ? String(row.recoveryInvoiceLabel) : "",
    sarfaesiInvoiceLabel:
      sarfaesiInvoice && row.sarfaesiInvoiceLabel != null ? String(row.sarfaesiInvoiceLabel) : "",
    vehicleInvoiceLabel:
      vehicleInvoice && row.vehicleInvoiceLabel != null ? String(row.vehicleInvoiceLabel) : ""
  };
}

/**
 * Clears invoice FK ids and labels when id is not positive.
 *
 * @param {Record<string, unknown>} values
 */
export function normalizeInvoiceLookupAutoValues(values) {
  const out = { ...values };
  for (const field of INVOICES_RECEIVED_INVOICE_FK_FIELDS) {
    const labelKey = invoiceLookupLabelKey(field);
    const id = normalizeInvoiceFkId(out[field]);
    if (!id) {
      out[field] = "";
      out[labelKey] = "";
    } else {
      out[field] = id;
    }
  }
  return out;
}
