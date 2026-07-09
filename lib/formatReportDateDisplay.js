// Shared report helper — calendar dates as DD-MM-YYYY (HTML, Excel, filter summary).

import { toYyyyMmDdForSqlDateField } from "./sqlDateFieldValue";

/**
 * @param {unknown} value MySQL DATE string, ISO datetime, or pre-formatted DD-MM-YYYY / DD/MM/YYYY
 * @returns {string}
 */
export function formatReportDateDisplay(value) {
  const ymd = toYyyyMmDdForSqlDateField(value);
  if (!ymd) return String(value ?? "");
  const [y, mo, d] = ymd.split("-");
  return `${d}-${mo}-${y}`;
}
