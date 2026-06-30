/**
 * Optional NCI dimension filters for case-based reports.
 * Unit applies only when selected in the report header (nci.unit on new_case_inward).
 */

/**
 * @param {Record<string, unknown>} filters
 * @param {string[]} parts
 * @param {unknown[]} values
 * @param {string} [nciAlias]
 */
export function appendNciUnitFilterIfSelected(filters, parts, values, nciAlias = "nci") {
  if (filters.unit && Number.isFinite(Number(filters.unit))) {
    parts.push(`${nciAlias}.unit = ?`);
    values.push(Number(filters.unit));
  }
}

/**
 * Invoice reports — unit filter uses Bill to Unit on the invoice row only.
 * @param {Record<string, unknown>} filters
 * @param {string[]} parts
 * @param {unknown[]} values
 * @param {string} [invAlias]
 */
export function appendInvoiceBillToUnitFilterIfSelected(
  filters,
  parts,
  values,
  invAlias = "inv"
) {
  if (filters.unit && Number.isFinite(Number(filters.unit))) {
    parts.push(`${invAlias}.billToUnit = ?`);
    values.push(Number(filters.unit));
  }
}

/**
 * Invoices Received Ledger — unit from linked invoice billToUnit columns only.
 * @param {Record<string, unknown>} filters
 * @param {string[]} parts
 * @param {unknown[]} values
 */
export function appendInvoicesReceivedBillToUnitFilterIfSelected(filters, parts, values) {
  if (filters.unit && Number.isFinite(Number(filters.unit))) {
    parts.push("COALESCE(ri.billToUnit, si.billToUnit, vi.billToUnit) = ?");
    values.push(Number(filters.unit));
  }
}
