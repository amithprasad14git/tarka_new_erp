// Shared report helper — hide columns when matching filter is selected.

/**
 * Omits columns with hideWhenFilterSet when that filter has a value (legacy PHP parity).
 * Same column list is used for HTML and Excel. See docs/REPORTS.md § Column visibility.
 */

/**
 * @param {unknown} value
 * @param {{ type?: string } | undefined} field
 * @returns {boolean}
 */
export function isReportFilterActive(value, field) {
  if (value == null || value === "" || value === 0 || value === "0") return false;
  if (field?.type === "lookup") {
    return Number.isFinite(Number(value)) && Number(value) !== 0;
  }
  return String(value).trim() !== "";
}

/**
 * @param {Array<{ key: string, hideWhenFilterSet?: string }>} columns
 * @param {Array<{ name: string, type?: string }>} fields
 * @param {Record<string, unknown>} filters
 * @returns {Array<{ key: string, hideWhenFilterSet?: string }>}
 */
export function resolveVisibleReportColumns(columns, fields, filters) {
  const fieldByName = Object.fromEntries((fields || []).map((f) => [f.name, f]));
  const dataType = String(filters?.dataType ?? "").trim();
  return (columns || []).filter((col) => {
    if (col.hideWhenDataType && dataType && col.hideWhenDataType === dataType) {
      return false;
    }
    const filterName = col.hideWhenFilterSet;
    if (!filterName) return true;
    return !isReportFilterActive(filters[filterName], fieldByName[filterName]);
  });
}
