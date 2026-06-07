// Excel — Unit Wise Cummulative Summary (flat 4-column layout).

import ExcelJS from "exceljs";
import { formatInrNumberForDisplay } from "../../../formatInrNumber";
import { REPORT_EXPORT_THEME } from "../../../../config/reportExportTheme";
import { addReportExcelLogo } from "../../addReportExcelLogo";
import { excelCellAlignment } from "../../buildReportWorkbook";

const FILL_ZEBRA = "FFF0F4F8";
const FILL_TOTAL = "FFFFD966";
const FILL_HEAD = "FF8BD08B";
const FILL_EVEN = "FFFFFFFF";
const COL_COUNT = 4;

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

function formatInr(value) {
  const f = formatInrNumberForDisplay(value, { fixedDecimals: 2 });
  return f !== "" ? f : "0.00";
}

function writeShellRows(ws, payload, excelTheme, startRow) {
  const layout = payload?.reportLayout || {};
  const custom = payload?.custom || {};
  const title = layout.title || "UNIT WISE CUMMULATIVE REPORT";
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

const HEADER_ALIGN = ["left", "right", "right", "right"];
const ROW_ALIGN = ["left", "right", "right", "right"];

/**
 * @param {object} reportConfig
 * @param {{ custom: object, filterSummary?: string, reportLayout?: object }} payload
 */
export async function buildSummaryWorkbook(reportConfig, payload) {
  const wb = new ExcelJS.Workbook();
  const sheetName = String(reportConfig?.label || "Report").slice(0, 31);
  const ws = wb.addWorksheet(sheetName);
  const excelTheme = reportConfig?.exportTheme?.excel || REPORT_EXPORT_THEME.excel;
  const layout = reportConfig?.reportLayout || {};
  const custom = payload?.custom || {};
  const rows = custom.rows || [];
  const totals = custom.totals || { caseCount: 0, cashRecovered: 0, npaReduced: 0 };

  ws.views = [{ state: "normal", showGridLines: excelTheme.showGridLines }];

  let rowIdx = addReportExcelLogo(wb, ws, layout, excelTheme);
  rowIdx = writeShellRows(
    ws,
    { ...payload, custom, reportLayout: layout },
    excelTheme,
    rowIdx
  );

  ws.getCell(rowIdx, 1).value = "UNIT";
  ws.getCell(rowIdx, 2).value = "NO. OF CASES";
  ws.getCell(rowIdx, 3).value = "AMOUNT RECOVERED";
  ws.getCell(rowIdx, 4).value = "NPA REDUCED";
  fillRow(ws, rowIdx, COL_COUNT, FILL_HEAD, { bold: true, horizontalByCol: HEADER_ALIGN });
  rowIdx++;

  rows.forEach((row, i) => {
    ws.getCell(rowIdx, 1).value = row.unitLabel ?? "";
    ws.getCell(rowIdx, 2).value = Number(row.caseCount) || 0;
    ws.getCell(rowIdx, 3).value = formatInr(row.cashRecovered);
    ws.getCell(rowIdx, 4).value = formatInr(row.npaReduced);
    fillRow(ws, rowIdx, COL_COUNT, i % 2 === 0 ? FILL_EVEN : FILL_ZEBRA, {
      horizontalByCol: ROW_ALIGN
    });
    rowIdx++;
  });

  ws.getCell(rowIdx, 2).value = Number(totals.caseCount) || 0;
  ws.getCell(rowIdx, 3).value = formatInr(totals.cashRecovered);
  ws.getCell(rowIdx, 4).value = formatInr(totals.npaReduced);
  fillRow(ws, rowIdx, COL_COUNT, FILL_TOTAL, { bold: true, horizontalByCol: ROW_ALIGN });
  rowIdx++;

  ws.getColumn(1).width = 28;
  ws.getColumn(2).width = 14;
  ws.getColumn(3).width = 18;
  ws.getColumn(4).width = 18;

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
