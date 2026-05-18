// Shared library helper for reusable application logic.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Grid/list cell formatting (dates, INR-style numbers). For SQL `LIKE` escaping see lib/sqlLikeEscape.js.
 *
 * MySQL DATE often serializes as ISO datetime; calendar day must match
 * {@link toYyyyMmDdForSqlDateField} so view grid and edit `<input type="date">` stay aligned.
 */
import { formatInrNumberForDisplay, parseNumericCellValue } from "./formatInrNumber";
import { toYyyyMmDdForSqlDateField } from "./sqlDateFieldValue";

/**
 * Grid cell: DATE as DD-MM-YYYY; NUMBER as en-IN grouping (no currency symbol).
 * @param {{ type?: string, integerOnly?: boolean }} field
 * @param {unknown} value
 */
export function formatViewCellValue(field, value) {
  if (value == null || value === "") return "";
  if (field?.type === "date") {
    const ymd = toYyyyMmDdForSqlDateField(value);
    if (ymd) {
      const [y, mo, d] = ymd.split("-");
      return `${d}-${mo}-${y}`;
    }
    return String(value);
  }
  if (field?.type === "number") {
    const formatted = formatInrNumberForDisplay(value, { integerOnly: Boolean(field.integerOnly) });
    if (formatted !== "") return formatted;
    return parseNumericCellValue(value) == null ? String(value) : formatted;
  }
  return value;
}
