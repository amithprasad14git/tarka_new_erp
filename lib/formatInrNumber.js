// Shared library helper for reusable application logic.
// Keep module-specific business logic in lib/modules/<module> files.

/** Strips commas and parses a numeric cell; returns null when not a finite number. */
export function parseNumericCellValue(value) {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * Indian digit grouping for view grids and read-only cells (no ₹ / Rs.).
 * @param {unknown} value
 * @param {{ integerOnly?: boolean, fixedDecimals?: number }} [options]
 * @returns {string} Empty when value is null/empty; otherwise formatted text.
 */
export function formatInrNumberForDisplay(value, { integerOnly = false, fixedDecimals = null } = {}) {
  const n = parseNumericCellValue(value);
  if (n == null) return "";
  // Integer-only fields (counts, IDs) never show decimal places.
  if (integerOnly) {
    return new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 0,
      useGrouping: true
    }).format(Math.trunc(n));
  }
  if (Number.isFinite(fixedDecimals) && fixedDecimals >= 0) {
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: fixedDecimals,
      maximumFractionDigits: fixedDecimals,
      useGrouping: true
    }).format(n);
  }
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(n);
}

/** Report HTML/Excel money cells — always 2 decimal places (en-IN grouping). */
export function formatReportAmountForDisplay(value) {
  return formatInrNumberForDisplay(value, { fixedDecimals: 2 });
}

/** Dashboard widgets — ₹ prefix with en-IN grouping (2 decimals). */
export function formatDashboardInrAmount(value) {
  const formatted = formatReportAmountForDisplay(value);
  return formatted ? `\u20B9 ${formatted}` : "\u20B9 0.00";
}

/** Dashboard chart axis — compact ₹ (Cr / L) for large amounts. */
export function formatDashboardInrAmountShort(value) {
  const n = parseNumericCellValue(value);
  if (n == null) return "\u20B9 0";
  const abs = Math.abs(n);
  if (abs >= 1e7) {
    return `\u20B9 ${(n / 1e7).toFixed(1)} Cr`;
  }
  if (abs >= 1e5) {
    return `\u20B9 ${(n / 1e5).toFixed(1)} L`;
  }
  return formatDashboardInrAmount(n);
}


