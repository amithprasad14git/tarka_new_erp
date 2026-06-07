// Shared library helper for reusable application logic.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * =============================================================================
 * Reading a cell value from a list row (grid / table)
 * =============================================================================
 * The app asks for fields by the names in config (e.g. caseNo). MySQL sometimes
 * returns column names in a different letter case, so `row.caseNo` might be empty
 * while the data is in `row.caseno`. This helper tries the exact name, then a
 * lowercase version, so lists show the right value without duplicating that logic
 * everywhere.
 * =============================================================================
 */
export function rowValueForField(row, fieldName) {
  if (!row || fieldName == null) return undefined;
  const key = String(fieldName);
  if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
  // MySQL drivers may return lowercase column names — try that fallback.
  const lower = key.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(row, lower)) return row[lower];
  return row[key];
}

