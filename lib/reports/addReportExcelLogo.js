// Shared report helper — insert logo in Excel export.

/**
 * Places the report banner logo with editAs: oneCell (older Excel compatible).
 * Absolute anchors often overlap the title on Excel 2016 and earlier; oneCell keeps
 * the image in the reserved logo rows. Size uses fixed pixel ext (does not stretch
 * like twoCell when table column widths change later).
 * Used by buildReportWorkbook.js and custom buildCustomWorkbook.js.
 */

import fs from "fs";
import { imageExtensionForExcel, resolveReportLogoFile } from "./resolveReportLogoFile";
import { logoHeightPxToPoints } from "./excelWrapLayout";

/**
 * @param {string} filePath
 * @returns {{ width: number, height: number } | null}
 */
function readPngDimensions(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length < 24) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/**
 * @param {number} logoHeightPx
 * @param {string} logoFile
 * @param {object} excelTheme
 * @returns {number}
 */
function resolveLogoWidthPx(logoHeightPx, logoFile, excelTheme) {
  const themed = Number(excelTheme.logoExtWidth);
  if (Number.isFinite(themed) && themed > 0) return themed;

  const dim = readPngDimensions(logoFile);
  if (dim?.width && dim?.height) {
    return Math.round(logoHeightPx * (dim.width / dim.height));
  }
  return 396;
}

/**
 * Split total logo band height (points) across logoRowCount rows.
 * @param {number} totalPoints
 * @param {number} rowCount
 * @returns {number[]}
 */
function splitLogoRowHeights(totalPoints, rowCount) {
  const n = Math.max(rowCount, 1);
  const base = Math.floor(totalPoints / n);
  const heights = Array.from({ length: n }, () => base);
  let rem = totalPoints - base * n;
  for (let i = 0; i < rem; i++) heights[i] += 1;
  return heights;
}

/**
 * @param {import("exceljs").Workbook} wb
 * @param {import("exceljs").Worksheet} ws
 * @param {object} layout reportLayout (showLogo, logoPath)
 * @param {object} excelTheme exportTheme.excel
 * @returns {number} Next 1-based row index for content below the logo block
 */
export function addReportExcelLogo(wb, ws, layout, excelTheme) {
  let rowIdx = 1;
  const showLogo = layout.showLogo !== false;
  const logoFile = showLogo && layout.logoPath ? resolveReportLogoFile(layout.logoPath) : null;
  const logoRowCount = Number(excelTheme.logoRowCount) || 2;
  if (!logoFile) return rowIdx;

  const logoHeightPx = Number(excelTheme.logoExtHeight) || 58;
  const logoWidthPx = resolveLogoWidthPx(logoHeightPx, logoFile, excelTheme);

  // Reserve enough points under the image so the title never sits under the logo (older Excel).
  const themedHeights = excelTheme.logoRowHeights;
  const totalNeeded = logoHeightPxToPoints(logoHeightPx, 10);
  const rowHeights =
    Array.isArray(themedHeights) && themedHeights.length >= logoRowCount
      ? themedHeights
      : splitLogoRowHeights(Math.max(totalNeeded, 52), logoRowCount);

  // If theme heights are shorter than the image, bump proportionally.
  const themedTotal = rowHeights.slice(0, logoRowCount).reduce((a, b) => a + Number(b || 0), 0);
  const heights =
    themedTotal >= totalNeeded
      ? rowHeights
      : splitLogoRowHeights(totalNeeded, logoRowCount);

  for (let i = 0; i < logoRowCount; i++) {
    ws.getRow(rowIdx + i).height = heights[i] ?? heights[heights.length - 1];
  }

  const imageId = wb.addImage({
    filename: logoFile,
    extension: imageExtensionForExcel(logoFile)
  });

  // oneCell + fixed ext: sits in reserved logo rows; does not stretch with column widths.
  ws.addImage(imageId, {
    tl: { col: 0, row: 0 },
    ext: { width: logoWidthPx, height: logoHeightPx },
    editAs: "oneCell"
  });

  return rowIdx + logoRowCount;
}
