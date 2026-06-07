// Shared library helper for reusable application logic.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * MySQL DATE / DATETIME values often arrive as ISO strings or JS Date objects.
 * For calendar-only fields we must not mix "list SQL date" vs "ISO instant" inconsistently:
 * - List/grid uses DATE_FORMAT → plain `YYYY-MM-DD` (calendar day in the DB).
 * - GET-by-id / JSON may expose `2026-04-05T18:30:00.000Z` for the same business day as 06-04-2026 IST;
 *   taking the first 10 characters (UTC date) would show 05-04-2026 in the form — wrong.
 * - {@link formatViewCellValue} and `<input type="date">` both use this helper so view and edit match.
 */

import { getYmdISTFromInstant } from "./istDateTime";

/** Pure SQL DATE or canonical `YYYY-MM-DD` only (no time / zone). */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
/** Naive MySQL DATETIME string (no `Z` / offset) — date part is the business calendar day. */
const NAIVE_DATETIME = /^(\d{4}-\d{2}-\d{2})[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/;

/**
 * @param {unknown} value
 * @returns {string} YYYY-MM-DD or "" if unknown
 */
export function toYyyyMmDdForSqlDateField(value) {
  if (value == null || value === "") return "";
  if (typeof value === "string") {
    const s = value.trim();
    if (DATE_ONLY.test(s)) return s;
    const naive = NAIVE_DATETIME.exec(s);
    if (naive && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
      // Naive MySQL datetime — take the date part as-is (no timezone shift).
      return naive[1];
    }
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      // ISO/UTC strings: convert instant to IST calendar day.
      return getYmdISTFromInstant(d);
    }
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
  }
  if (Object.prototype.toString.call(value) === "[object Date]") {
    const d = /** @type {Date} */ (value);
    if (Number.isNaN(d.getTime())) return "";
    return getYmdISTFromInstant(d);
  }
  return "";
}

