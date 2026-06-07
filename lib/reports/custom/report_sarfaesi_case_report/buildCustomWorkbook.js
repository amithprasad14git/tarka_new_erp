// Excel — SARFAESI Case Report (4-row blocks per case, legacy colors).

import ExcelJS from "exceljs";
import { formatInrNumberForDisplay } from "../../../formatInrNumber";
import { toYyyyMmDdForSqlDateField } from "../../../sqlDateFieldValue";
import { REPORT_EXPORT_THEME } from "../../../../config/reportExportTheme";
import { addReportExcelLogo } from "../../addReportExcelLogo";
import { excelCellAlignment } from "../../buildReportWorkbook";

const FILL_PRIMARY_HEAD = "FFFFD966";
const FILL_SUB_HEAD = "FFD9EEF2";
const PRIMARY_HEADERS = [
  "Sl. No.",
  "Case No",
  "Branch",
  "Borrower",
  "Loan AC",
  "Loan Type",
  "NPA Date",
  "NPA Status",
  "Entrustment Date",
  "Closure Balance"
];

const BORDER_THIN = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" }
};

/** @param {import("exceljs").Cell} cell */
function setCellAlign(cell, horizontal = "center") {
  cell.alignment = excelCellAlignment(horizontal, "middle");
}

function formatDate(value) {
  const ymd = toYyyyMmDdForSqlDateField(value);
  if (!ymd) return "";
  const [y, mo, d] = ymd.split("-");
  return `${d}/${mo}/${y}`;
}

function formatInr(value) {
  const f = formatInrNumberForDisplay(value, { fixedDecimals: 2 });
  return f !== "" ? f : "0.00";
}

function formatClosureBalance(value) {
  const f = formatInr(value);
  return f ? `Rs. ${f}` : "";
}

function formatAmountRecovered(value) {
  return formatInr(value);
}

const TRAILING_SUB_COLUMNS = [
  { key: "amount-recovered", label: "Amount Recovered" },
  { key: "remarks", label: "Remarks" }
];

const RESERVED_SUB_COLUMN_LABELS = new Set(["amount recovered", "remarks"]);

function buildSubColumns(particulars) {
  const master = (particulars || []).filter(
    (p) => !RESERVED_SUB_COLUMN_LABELS.has(String(p.label || "").trim().toLowerCase())
  );
  return [
    ...master.map((p) => ({
      key: `particular-${p.id}`,
      label: p.label,
      particularId: p.id
    })),
    ...TRAILING_SUB_COLUMNS.map((col) => ({ ...col, particularId: null }))
  ];
}

function subColumnValue(caseRow, col) {
  if (col.key === "amount-recovered") return formatAmountRecovered(caseRow.amountRecovered);
  if (col.key === "remarks") return caseRow.caseStatusRemarks ?? "";
  const raw = caseRow.particularsById?.[col.particularId];
  return raw != null ? String(raw) : "";
}

function maxColumnCount(particulars) {
  const subCount = buildSubColumns(particulars).length;
  return Math.max(PRIMARY_HEADERS.length, 1 + subCount);
}

function applyBorderAndAlign(ws, rowIdx, colCount, { fill = null, bold = false, horizontal = "center" } = {}) {
  const row = ws.getRow(rowIdx);
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    if (fill) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    }
    if (bold) cell.font = { ...(cell.font || {}), bold: true };
    cell.border = BORDER_THIN;
    setCellAlign(cell, horizontal);
  }
}

function writeShellRows(ws, payload, excelTheme, startRow, colCount) {
  const layout = payload?.reportLayout || {};
  const custom = payload?.custom || {};
  const title = layout.title || "PENDING SARFAESI CASES STATUS";
  const asOn = custom.asOnDate ? formatDate(custom.asOnDate) : "";
  const filterSummary = String(payload?.filterSummary || "");
  let rowIdx = startRow;

  if (layout.title) {
    ws.mergeCells(rowIdx, 1, rowIdx, colCount);
    ws.getCell(rowIdx, 1).value = title;
    ws.getCell(rowIdx, 1).font = { size: excelTheme.titleFontSize || 12, bold: true };
    rowIdx++;
  }

  if (asOn) {
    ws.mergeCells(rowIdx, 1, rowIdx, colCount);
    ws.getCell(rowIdx, 1).value = `As On Date: ${asOn}`;
    ws.getCell(rowIdx, 1).font = { size: excelTheme.filterFontSize || 10, bold: true };
    rowIdx++;
  }

  if (filterSummary) {
    ws.mergeCells(rowIdx, 1, rowIdx, colCount);
    ws.getCell(rowIdx, 1).value = filterSummary;
    ws.getCell(rowIdx, 1).font = { size: excelTheme.filterFontSize || 10 };
    ws.getCell(rowIdx, 1).alignment = excelCellAlignment("left");
    rowIdx++;
  }

  return rowIdx + 1;
}

function writeCaseBlock(ws, caseRow, particulars, startRow) {
  const colCount = maxColumnCount(particulars);
  const subColumns = buildSubColumns(particulars);

  const headRow = startRow;
  for (let c = 0; c < PRIMARY_HEADERS.length; c++) {
    ws.getCell(headRow, c + 1).value = PRIMARY_HEADERS[c];
  }
  applyBorderAndAlign(ws, headRow, colCount, { fill: FILL_PRIMARY_HEAD, bold: true });

  const dataRow = headRow + 1;
  ws.getCell(dataRow, 1).value = caseRow.slNo;
  ws.getCell(dataRow, 2).value = caseRow.caseNo ?? "";
  ws.getCell(dataRow, 3).value = caseRow.branchLabel ?? "";
  ws.getCell(dataRow, 4).value = caseRow.borrower ?? "";
  ws.getCell(dataRow, 5).value = caseRow.loanAccountNo != null ? String(caseRow.loanAccountNo) : "";
  ws.getCell(dataRow, 6).value = caseRow.loanTypeLabel ?? "";
  ws.getCell(dataRow, 7).value = formatDate(caseRow.npaDate);
  ws.getCell(dataRow, 8).value = caseRow.npaStatusLabel ?? "";
  ws.getCell(dataRow, 9).value = formatDate(caseRow.entrustmentDate);
  ws.getCell(dataRow, 10).value = formatClosureBalance(caseRow.closureBalance);
  applyBorderAndAlign(ws, dataRow, colCount);

  const subHeadRow = dataRow + 1;
  for (let i = 0; i < subColumns.length; i++) {
    ws.getCell(subHeadRow, 2 + i).value = subColumns[i].label;
  }
  applyBorderAndAlign(ws, subHeadRow, colCount, { fill: FILL_SUB_HEAD, bold: true });

  const subDataRow = subHeadRow + 1;
  for (let i = 0; i < subColumns.length; i++) {
    const cell = ws.getCell(subDataRow, 2 + i);
    cell.value = subColumnValue(caseRow, subColumns[i]);
    const horizontal = subColumns[i].key === "remarks" ? "left" : "center";
    setCellAlign(cell, horizontal);
  }
  applyBorderAndAlign(ws, subDataRow, colCount);

  ws.mergeCells(dataRow, 1, subDataRow, 1);
  setCellAlign(ws.getCell(dataRow, 1), "center");

  return subDataRow + 3;
}

/**
 * @param {object} reportConfig
 * @param {{ custom: object, filterSummary?: string, reportLayout?: object }} payload
 */
export async function buildCustomWorkbook(reportConfig, payload) {
  const wb = new ExcelJS.Workbook();
  const sheetName = String(reportConfig?.label || "Report").slice(0, 31);
  const ws = wb.addWorksheet(sheetName);
  const excelTheme = reportConfig?.exportTheme?.excel || REPORT_EXPORT_THEME.excel;
  const layout = reportConfig?.reportLayout || {};
  const custom = payload?.custom || {};
  const particulars = custom.particulars || [];
  const cases = custom.cases || [];
  const colCount = maxColumnCount(particulars);

  ws.views = [{ state: "normal", showGridLines: excelTheme.showGridLines }];

  let rowIdx = addReportExcelLogo(wb, ws, layout, excelTheme);
  rowIdx = writeShellRows(ws, { ...payload, custom, reportLayout: layout }, excelTheme, rowIdx, colCount);

  for (const caseRow of cases) {
    rowIdx = writeCaseBlock(ws, caseRow, particulars, rowIdx);
  }

  const subColumns = buildSubColumns(particulars);
  const remarksCol = 1 + subColumns.length;
  const defaultColWidth = 8;
  const remarksColWidth = 14;

  ws.getColumn(1).width = 6;
  for (let c = 2; c <= colCount; c++) {
    ws.getColumn(c).width = c === remarksCol ? remarksColWidth : defaultColWidth;
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
