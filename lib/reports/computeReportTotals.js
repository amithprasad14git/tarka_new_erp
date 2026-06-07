// Shared report helper — sum numeric columns for footer row.

/**
 * Sums columns with sum: true in config/reports.js for the footer totals row (HTML + Excel).
 */

import { parseNumericCellValue } from "../formatInrNumber";

/**
 * @param {Array<{ key: string, sum?: boolean, type?: string }>} columns
 * @param {Array<Record<string, unknown>>} rows
 * @returns {Record<string, number>}
 */
export function computeReportTotals(columns, rows) {
  const totals = {};
  for (const col of columns || []) {
    if (!col.sum) continue;
    let sum = 0;
    for (const row of rows) {
      const n = parseNumericCellValue(row[col.key]);
      if (n != null) sum += n;
    }
    totals[col.key] = sum;
  }
  return totals;
}
