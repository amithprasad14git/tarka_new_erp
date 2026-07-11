// Dashboard — invoice table sources for Invoice Collections aggregation.

/**
 * Maps each invoice module to SQL table name, FK on invoices_received, and display label.
 * aggregateInvoiceCollections.js loops INVOICE_SOURCES for billed/received/pending queries.
 */

export const INVOICE_SOURCES = [
  {
    table: "recovery_invoice",
    receivedFk: "recoveryInvoice",
    typeKey: "recovery",
    typeLabel: "Recovery"
  },
  {
    table: "sarfaesi_invoice",
    receivedFk: "sarfaesiInvoice",
    typeKey: "sarfaesi",
    typeLabel: "SARFAESI"
  },
  {
    table: "vehicle_invoice",
    receivedFk: "vehicleInvoice",
    typeKey: "vehicle",
    typeLabel: "Vehicle"
  }
];

/** Set of typeKey strings for drilldown view validation in InvoiceCollectionsSummaryModal. */
export const INVOICE_TYPE_KEYS = new Set(INVOICE_SOURCES.map((s) => s.typeKey));

