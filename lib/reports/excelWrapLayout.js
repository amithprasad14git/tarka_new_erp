// Shared report helper — Excel column widths and wrapped row heights for older Excel.
// xlsx cannot store “auto” row height; bake sizes so files open fitted without Autofit.
// Wrap-enabled columns (e.g. Remarks) keep config width — never grow to full text length.

const CHARS_PER_WIDTH_UNIT = 1.15;
const DEFAULT_FONT_SIZE = 9;
const LINE_HEIGHT_FACTOR = 1.35;
const MIN_ROW_HEIGHT = 15;
const MAX_WRAP_LINES = 8;
const MAX_WRAP_COLUMN_WIDTH = 40;
const MAX_NOWRAP_COLUMN_WIDTH = 28;

/**
 * Approximate number of wrapped lines for text in an Excel column width unit.
 * @param {unknown} text
 * @param {number} columnWidth
 * @returns {number}
 */
export function estimateWrappedLineCount(text, columnWidth) {
  const s = String(text ?? "").trim();
  if (!s) return 1;
  const width = Math.max(Number(columnWidth) || 12, 1);
  const charsPerLine = Math.max(Math.floor(width * CHARS_PER_WIDTH_UNIT), 1);
  // Honour explicit newlines; otherwise estimate from length.
  const paragraphs = s.split(/\r?\n/);
  let lines = 0;
  for (const p of paragraphs) {
    const len = p.length || 1;
    lines += Math.ceil(len / charsPerLine);
  }
  return Math.min(Math.max(lines, 1), MAX_WRAP_LINES);
}

/**
 * Row height in points for wrapped cell content.
 * @param {unknown} text
 * @param {number} columnWidth
 * @param {number} [fontSize]
 * @returns {number}
 */
export function estimateWrappedRowHeight(text, columnWidth, fontSize = DEFAULT_FONT_SIZE) {
  const lines = estimateWrappedLineCount(text, columnWidth);
  const size = Number(fontSize) || DEFAULT_FONT_SIZE;
  return Math.max(MIN_ROW_HEIGHT, Math.round(lines * size * LINE_HEIGHT_FACTOR));
}

/**
 * Tallest wrapped height among cells in a row.
 * @param {Array<{ text: unknown, columnWidth: number, wrap?: boolean }>} cells
 * @param {number} [fontSize]
 * @returns {number}
 */
export function estimateRowHeightFromCells(cells, fontSize = DEFAULT_FONT_SIZE) {
  let maxH = MIN_ROW_HEIGHT;
  for (const cell of cells || []) {
    if (cell.wrap === false) continue;
    const h = estimateWrappedRowHeight(cell.text, cell.columnWidth, fontSize);
    if (h > maxH) maxH = h;
  }
  return maxH;
}

/**
 * Whether this report column uses wrap text in Excel (dates/amounts/counts do not).
 * @param {{ type?: string } | null | undefined} col
 * @returns {boolean}
 */
export function excelColumnWrapsText(col) {
  const t = col?.type;
  return t !== "inr" && t !== "number" && t !== "date";
}

/**
 * Resolve Excel column width so wrap columns stay at config size (Remarks, etc.).
 * Nowrap columns may widen slightly to fit content.
 * @param {number | string | undefined} configuredWidth widthExcel from config
 * @param {unknown[]} sampleTexts header + cell samples
 * @param {{ wrapsText?: boolean }} [options]
 * @returns {number}
 */
export function resolveExcelColumnWidth(configuredWidth, sampleTexts = [], options = {}) {
  const configured = Number(configuredWidth);
  const base = Number.isFinite(configured) && configured > 0 ? configured : 12;
  const wrapsText = options.wrapsText !== false;

  // Long text (remarks): keep config width so wrap + row height apply — never Autofit to full string.
  if (wrapsText) {
    return Math.min(Math.max(base, 4), MAX_WRAP_COLUMN_WIDTH);
  }

  let contentWidth = 0;
  for (const sample of sampleTexts || []) {
    const s = String(sample ?? "").trim();
    if (!s) continue;
    // Rough Excel width units from character count.
    contentWidth = Math.max(contentWidth, s.length / CHARS_PER_WIDTH_UNIT + 1);
  }
  return Math.min(Math.max(base, contentWidth, 4), MAX_NOWRAP_COLUMN_WIDTH);
}

/**
 * Convert logo pixel height to Excel row-height points (96 DPI).
 * @param {number} heightPx
 * @param {number} [padPoints]
 * @returns {number}
 */
export function logoHeightPxToPoints(heightPx, padPoints = 8) {
  const px = Number(heightPx) || 58;
  return Math.ceil((px * 72) / 96) + (Number(padPoints) || 0);
}
