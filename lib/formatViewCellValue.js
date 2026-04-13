/**
 * Grid/list cell formatting (mostly dates). For SQL `LIKE` escaping see lib/sqlLikeEscape.js.
 *
 * MySQL DATE often serializes as ISO datetime; we avoid the local timezone when showing a calendar
 * day so the grid does not show “one day earlier” in non-UTC zones.
 */

/**
 * Extract Y/M/D from a value without applying local timezone to pure dates.
 * @param {unknown} value
 * @returns {{ d: string, mo: string, y: string } | null}
 */
function parseCalendarYmdParts(value) {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return { y: m[1], mo: m[2], d: m[3] };
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return {
      y: String(value.getUTCFullYear()),
      mo: String(value.getUTCMonth() + 1).padStart(2, "0"),
      d: String(value.getUTCDate()).padStart(2, "0")
    };
  }
  return null;
}

/**
 * Grid cell: show DATE as DD-MM-YYYY.
 * @param {{ type?: string }} field
 * @param {unknown} value
 */
export function formatViewCellValue(field, value) {
  if (value == null || value === "") return "";
  if (field?.type === "date") {
    const parts = parseCalendarYmdParts(value);
    if (parts) return `${parts.d}-${parts.mo}-${parts.y}`;
    return String(value);
  }
  return value;
}
