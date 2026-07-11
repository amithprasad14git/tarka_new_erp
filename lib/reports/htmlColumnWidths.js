// Parse optional widthHtml into proportional column widths (%).
// widthHtml values are relative weights (e.g. "7rem"), not pixel minimums.
// Frozen HTML layout v1 — CSS reflow; no ResizeObserver. See README.md#reports-frozen-framework.

const MIN_WEIGHT = 2;
const DEFAULT_WEIGHT = 6;

/**
 * @param {string | number | undefined} widthHtml e.g. "7rem", "12%", "80px"
 * @returns {number}
 */
export function parseHtmlColumnWeight(widthHtml) {
  if (widthHtml == null || widthHtml === "") return DEFAULT_WEIGHT;
  const s = String(widthHtml).trim();
  const rem = /^([\d.]+)\s*rem$/i.exec(s);
  if (rem) return Math.max(MIN_WEIGHT, parseFloat(rem[1]));
  const px = /^([\d.]+)\s*px$/i.exec(s);
  if (px) return Math.max(MIN_WEIGHT, parseFloat(px[1]) / 16);
  const pct = /^([\d.]+)\s*%$/i.exec(s);
  if (pct) return Math.max(MIN_WEIGHT, parseFloat(pct[1]));
  const num = Number(s);
  if (Number.isFinite(num) && num > 0) return Math.max(MIN_WEIGHT, num);
  return DEFAULT_WEIGHT;
}

/**
 * @param {Array<{ widthHtml?: string }>} columns
 * @returns {string[]} CSS width per column (percentages summing to 100%)
 */
export function htmlColumnWidthPercents(columns) {
  const weights = (columns || []).map((col) => parseHtmlColumnWeight(col.widthHtml));
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  return weights.map((w) => `${((w / sum) * 100).toFixed(4)}%`);
}

