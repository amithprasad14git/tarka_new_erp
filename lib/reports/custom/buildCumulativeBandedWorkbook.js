// Excel — shared banded cumulative report layout (section rowspan × detail rows).

import ExcelJS from "exceljs";
import { formatInrNumberForDisplay } from "../../formatInrNumber";
import { REPORT_EXPORT_THEME } from "../../../config/reportExportTheme";
import { addReportExcelLogo } from "../addReportExcelLogo";
import { excelCellAlignment } from "../buildReportWorkbook";

const FILL_HEADING = "FF8BD08B";
const FILL_SUBTOTAL = "FFB4DCE4";
const FILL_GRAND = "FFFFD966";
const COL_COUNT = 5;

const BORDER_THIN = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" }
};

/** @param {import("exceljs").Cell} cell */
function setCellAlign(cell, horizontal = "left") {
  cell.alignment = excelCellAlignment(horizontal, "middle");
}

function fillRow(ws, rowIdx, colCount, argb, { bold = false, horizontalByCol = null } = {}) {
  const row = ws.getRow(rowIdx);
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
    if (bold) cell.font = { ...(cell.font || {}), bold: true };
    cell.border = BORDER_THIN;
    setCellAlign(cell, horizontalByCol?.[c - 1] ?? "left");
  }
}

function borderRow(ws, rowIdx, colCount, { bold = false, horizontalByCol = null } = {}) {
  const row = ws.getRow(rowIdx);
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    if (bold) cell.font = { ...(cell.font || {}), bold: true };
    cell.border = BORDER_THIN;
    setCellAlign(cell, horizontalByCol?.[c - 1] ?? "left");
  }
}

function formatInr(value) {
  const f = formatInrNumberForDisplay(value, { fixedDecimals: 2 });
  return f !== "" ? f : "0.00";
}

function sectionLabel(section) {
  return section.sectionLabel ?? section.regionLabel ?? "";
}

function detailLabel(detail) {
  return detail.detailLabel ?? detail.loanCategoryLabel ?? detail.unitLabel ?? "";
}

function writeShellRows(ws, payload, excelTheme, startRow) {
  const layout = payload?.reportLayout || {};
  const custom = payload?.custom || {};
  const title = layout.title || "CUMMULATIVE REPORT";
  const fyRange = custom.financialYear?.yearRangeLabel || "";
  const filterSummary = String(payload?.filterSummary || "");
  let rowIdx = startRow;

  if (layout.title) {
    ws.mergeCells(rowIdx, 1, rowIdx, COL_COUNT);
    ws.getCell(rowIdx, 1).value = title;
    ws.getCell(rowIdx, 1).font = { size: excelTheme.titleFontSize || 12, bold: true };
    rowIdx++;
  }

  ws.mergeCells(rowIdx, 1, rowIdx, COL_COUNT);
  ws.getCell(rowIdx, 1).value = fyRange ? `Financial Year ${fyRange}` : "Financial Year";
  ws.getCell(rowIdx, 1).font = { size: excelTheme.filterFontSize || 10, bold: true };
  rowIdx++;

  if (filterSummary) {
    ws.mergeCells(rowIdx, 1, rowIdx, COL_COUNT);
    ws.getCell(rowIdx, 1).value = filterSummary;
    ws.getCell(rowIdx, 1).font = { size: excelTheme.filterFontSize || 10 };
    ws.getCell(rowIdx, 1).alignment = excelCellAlignment("left");
    rowIdx++;
  }

  return rowIdx + 1;
}

const DETAIL_ALIGN = ["left", "left", "center", "right", "right"];
const METRIC_HEADER_ALIGN = ["left", "left", "center", "center", "center"];

/**
 * @param {object} reportConfig
 * @param {{ custom: object, filterSummary?: string, reportLayout?: object }} payload
 * @param {{ recoveredColumnLabel?: string }} [options]
 */
export async function buildCumulativeBandedWorkbook(reportConfig, payload, options = {}) {
  const recoveredColumnLabel = options.recoveredColumnLabel || "Cash Recovered";
  const wb = new ExcelJS.Workbook();
  const sheetName = String(reportConfig?.label || "Report").slice(0, 31);
  const ws = wb.addWorksheet(sheetName);
  const excelTheme = reportConfig?.exportTheme?.excel || REPORT_EXPORT_THEME.excel;
  const layout = reportConfig?.reportLayout || {};
  const custom = payload?.custom || {};
  const sections = custom.sections || [];
  const grandTotal = custom.grandTotal || { caseCount: 0, cashRecovered: 0, npaReduced: 0 };
  const yearCode = custom.financialYear?.yearCode || "";

  ws.views = [{ state: "normal", showGridLines: excelTheme.showGridLines }];

  let rowIdx = addReportExcelLogo(wb, ws, layout, excelTheme);
  rowIdx = writeShellRows(
    ws,
    { ...payload, custom, reportLayout: layout },
    excelTheme,
    rowIdx
  );

  const headerRow1 = rowIdx;
  ws.mergeCells(headerRow1, 1, headerRow1 + 1, 2);
  ws.getCell(headerRow1, 1).value = "Particulars";
  ws.mergeCells(headerRow1, 3, headerRow1, COL_COUNT);
  ws.getCell(headerRow1, 3).value = yearCode
    ? `For the Financial Year ${yearCode}`
    : "For the Financial Year";
  fillRow(ws, headerRow1, COL_COUNT, FILL_HEADING, {
    bold: true,
    horizontalByCol: ["center", "center", "center", "center", "center"]
  });
  fillRow(ws, headerRow1 + 1, COL_COUNT, FILL_HEADING, {
    bold: true,
    horizontalByCol: METRIC_HEADER_ALIGN
  });
  rowIdx = headerRow1 + 1;
  ws.getCell(rowIdx, 3).value = "No. of Cases";
  ws.getCell(rowIdx, 4).value = recoveredColumnLabel;
  ws.getCell(rowIdx, 5).value = "NPA Reduced";
  rowIdx++;

  for (const section of sections) {
    const detailStart = rowIdx;
    for (const detail of section.details || []) {
      ws.getCell(rowIdx, 2).value = detailLabel(detail);
      ws.getCell(rowIdx, 3).value = Number(detail.caseCount) || 0;
      ws.getCell(rowIdx, 4).value = formatInr(detail.cashRecovered);
      ws.getCell(rowIdx, 5).value = formatInr(detail.npaReduced);
      borderRow(ws, rowIdx, COL_COUNT, { horizontalByCol: DETAIL_ALIGN });
      rowIdx++;
    }
    const detailEnd = rowIdx - 1;
    if (detailEnd >= detailStart) {
      ws.mergeCells(detailStart, 1, detailEnd, 1);
      ws.getCell(detailStart, 1).value = sectionLabel(section);
      ws.getCell(detailStart, 1).font = { bold: true };
      setCellAlign(ws.getCell(detailStart, 1), "left");
    }

    const sub = section.subtotal || {};
    ws.mergeCells(rowIdx, 1, rowIdx, 2);
    ws.getCell(rowIdx, 3).value = Number(sub.caseCount) || 0;
    ws.getCell(rowIdx, 4).value = formatInr(sub.cashRecovered);
    ws.getCell(rowIdx, 5).value = formatInr(sub.npaReduced);
    ws.getRow(rowIdx).font = { bold: true };
    fillRow(ws, rowIdx, COL_COUNT, FILL_SUBTOTAL, {
      bold: true,
      horizontalByCol: DETAIL_ALIGN
    });
    rowIdx++;
  }

  ws.mergeCells(rowIdx, 1, rowIdx, 2);
  ws.getCell(rowIdx, 1).value = "Grand Total";
  ws.getCell(rowIdx, 3).value = Number(grandTotal.caseCount) || 0;
  ws.getCell(rowIdx, 4).value = formatInr(grandTotal.cashRecovered);
  ws.getCell(rowIdx, 5).value = formatInr(grandTotal.npaReduced);
  ws.getRow(rowIdx).font = { bold: true };
  fillRow(ws, rowIdx, COL_COUNT, FILL_GRAND, {
    bold: true,
    horizontalByCol: ["left", "left", "center", "right", "right"]
  });

  ws.getColumn(1).width = 22;
  ws.getColumn(2).width = 24;
  ws.getColumn(3).width = 14;
  ws.getColumn(4).width = 18;
  ws.getColumn(5).width = 18;

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
