// Shared report helper — insert logo in Excel export.

/**
 * Places the report banner logo at a fixed pixel size (editAs: absolute).
 * Column-anchored logos stretch when table column widths are set later — this avoids that.
 * Used by buildReportWorkbook.js and custom buildCustomWorkbook.js. Theme: logoExtWidth / logoExtHeight.
 */

import fs from "fs";
import { imageExtensionForExcel, resolveReportLogoFile } from "./resolveReportLogoFile";

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

  // Reserve vertical space so title rows do not overlap the image.
  const rowHeights = excelTheme.logoRowHeights || [34, 24];
  for (let i = 0; i < logoRowCount; i++) {
    ws.getRow(rowIdx + i).height = rowHeights[i] ?? rowHeights[rowHeights.length - 1];
  }

  const imageId = wb.addImage({
    filename: logoFile,
    extension: imageExtensionForExcel(logoFile)
  });

  const logoHeightPx = Number(excelTheme.logoExtHeight) || 58;
  const logoWidthPx = resolveLogoWidthPx(logoHeightPx, logoFile, excelTheme);

  // Absolute anchor — width/height stay fixed when worksheet columns are resized below.
  ws.addImage(imageId, {
    tl: { col: 0, row: 0 },
    ext: { width: logoWidthPx, height: logoHeightPx },
    editAs: "absolute"
  });

  return rowIdx + logoRowCount;
}

