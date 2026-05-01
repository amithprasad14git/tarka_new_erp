// Shared library helper for reusable application logic.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Grid/list cell formatting (mostly dates). For SQL `LIKE` escaping see lib/sqlLikeEscape.js.
 *
 * MySQL DATE often serializes as ISO datetime; calendar day must match
 * {@link toYyyyMmDdForSqlDateField} so view grid and edit `<input type="date">` stay aligned.
 */
import { toYyyyMmDdForSqlDateField } from "./sqlDateFieldValue";

/**
 * Grid cell: show DATE as DD-MM-YYYY.
 * @param {{ type?: string }} field
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
  return value;
}
