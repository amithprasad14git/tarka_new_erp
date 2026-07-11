// Shared report helper — format cell values for HTML report table.

/**
 * Formats one table cell for ReportOutputView: dates (DD-MM-YYYY), INR, plain numbers.
 * Excel formatting is separate (buildReportWorkbook.formatCellValue).
 */

import {
  formatInrNumberForDisplay,
  formatReportAmountForDisplay,
  parseNumericCellValue
} from "./formatInrNumber";
import { formatReportDateDisplay } from "./formatReportDateDisplay";

/**
 * @param {{ type?: string }} column
 * @param {unknown} value
 */
export function formatReportCellValue(column, value) {
  if (value == null || value === "") return "";
  if (column?.type === "date") {
    return formatReportDateDisplay(value);
  }
  if (column?.type === "inr") {
    const f = formatReportAmountForDisplay(value);
    if (f !== "") return f;
    return parseNumericCellValue(value) == null ? String(value) : f;
  }
  if (column?.type === "number") {
    const f = formatInrNumberForDisplay(value, { integerOnly: true });
    if (f !== "") return f;
    return parseNumericCellValue(value) == null ? String(value) : f;
  }
  return String(value);
}

