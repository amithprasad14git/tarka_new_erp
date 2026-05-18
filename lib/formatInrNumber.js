// Shared library helper for reusable application logic.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Parse a grid/form numeric value (plain or already grouped).
 * @param {unknown} value
 * @returns {number | null}
 */
export function parseNumericCellValue(value) {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * Indian digit grouping for view grids and read-only cells (no ₹ / Rs.).
 * @param {unknown} value
 * @param {{ integerOnly?: boolean }} [options]
 * @returns {string} Empty when value is null/empty; otherwise formatted text.
 */
export function formatInrNumberForDisplay(value, { integerOnly = false } = {}) {
  const n = parseNumericCellValue(value);
  if (n == null) return "";
  if (integerOnly) {
    return new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 0,
      useGrouping: true
    }).format(Math.trunc(n));
  }
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(n);
}
