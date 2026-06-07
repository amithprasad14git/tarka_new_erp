// Shared report helper — financial year display label for report headers.

/**
 * Formats FY start/end dates as "2026 - 2027" for HTML and Excel header lines.
 * Used by loadFinancialYearById.js.
 */

import { toYyyyMmDdForSqlDateField } from "../sqlDateFieldValue";

/**
 * @param {unknown} startDate
 * @param {unknown} endDate
 * @returns {string}
 */
export function formatFinancialYearRangeLabel(startDate, endDate) {
  const startYmd = toYyyyMmDdForSqlDateField(startDate);
  const endYmd = toYyyyMmDdForSqlDateField(endDate);
  const startY = startYmd?.slice(0, 4) || "";
  const endY = endYmd?.slice(0, 4) || "";
  if (startY && endY) return `${startY} - ${endY}`;
  if (startY) return startY;
  return endY;
}
