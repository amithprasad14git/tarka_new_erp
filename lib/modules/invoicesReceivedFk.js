/**
 * =============================================================================
 * INVOICES RECEIVED — Invoice FK helpers (no React)
 * =============================================================================
 * An Invoices Received row links to exactly one of recovery / SARFAESI / vehicle
 * invoice. These pure helpers normalize FK ids and draft labels for the client
 * form and Jest tests (safe to import without mysql2).
 * =============================================================================
 */

/** The three mutually exclusive invoice FK field names on invoices_received. */
export const INVOICES_RECEIVED_INVOICE_FK_FIELDS = [
  "recoveryInvoice",
  "sarfaesiInvoice",
  "vehicleInvoice"
];

/**
 * Positive invoice FK id as string, or "" when unset / legacy 0.
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeInvoiceFkId(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? String(n) : "";
}

function invoiceLookupLabelKey(fieldName) {
  return `${fieldName}Label`;
}

/**
 * Build draft invoice FK + label fields from a saved invoices_received row.
 * @param {Record<string, unknown>|null|undefined} row
 * @returns {Record<string, string>}
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
