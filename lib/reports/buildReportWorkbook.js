// Shared report helper — build .xlsx buffer from report config + data.
// Frozen layout v1 — fonts, logo size, borders from reportExportTheme.excel. See docs/REPORTS.md.

/**
 * Standard table-report Excel builder. Logo via addReportExcelLogo, then title,
 * filter summary, column headers, zebra rows, totals row. Custom reports use
 * their own buildCustomWorkbook.js instead. Called from report.service.js only.
 */

import ExcelJS from "exceljs";
import { formatInrNumberForDisplay, formatReportAmountForDisplay } from "../formatInrNumber";
import { formatReportDateDisplay } from "../formatReportDateDisplay";
import { REPORT_EXPORT_THEME } from "../../config/reportExportTheme";
import { addReportExcelLogo } from "./addReportExcelLogo";

const CELL_BORDER = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" }
};

function excelFonts(theme = REPORT_EXPORT_THEME.excel) {
  const table = { size: theme.fontSize };
  return {
    table,
    tableBold: { size: theme.fontSize, bold: true },
    title: { size: theme.titleFontSize, bold: true },
    filter: { size: theme.filterFontSize }
  };
}

function formatCellValue(col, value) {
  if (value == null || value === "") return "";
  if (col.type === "date") {
    return formatReportDateDisplay(value);
  }
  if (col.type === "inr") {
    const f = formatReportAmountForDisplay(value);
    if (f !== "") return f;
  }
  if (col.type === "number") {
    const f = formatInrNumberForDisplay(value, { integerOnly: true });
    if (f !== "") return f;
  }
  return value;
}

/** Report table cell alignment; amount/number columns omit wrap text. */
export function excelCellAlignment(horizontal = "left", vertical = "middle", { wrapText = true } = {}) {
  return { horizontal, vertical, wrapText };
}

function excelAlignmentForColumn(col, horizontal) {
  const h = horizontal || col.align || "left";
  const nowrap = col.type === "inr" || col.type === "number";
  return excelCellAlignment(h, "middle", { wrapText: !nowrap });
}

function applyRowBorders(row, colCount) {
  for (let ci = 1; ci <= colCount; ci++) {
    row.getCell(ci).border = CELL_BORDER;
  }
}

/** Vertical column lines on data rows; outer left/right and bottom on last row. */
function applyDataRowBorders(row, colCount, { isLastDataRow = false } = {}) {
  for (let ci = 1; ci <= colCount; ci++) {
    const border = { left: CELL_BORDER.left };
    if (ci === colCount) border.right = CELL_BORDER.right;
    if (isLastDataRow) border.bottom = CELL_BORDER.bottom;
    row.getCell(ci).border = border;
  }
}

/**
 * @param {object} reportConfig
 * @param {{ rows: object[], totals: Record<string, number>, filterSummary: string, columns?: object[] }} payload
 * @returns {Promise<Buffer>}
 */
export async function buildReportWorkbook(reportConfig, payload) {
  const wb = new ExcelJS.Workbook();
  const sheetName = String(reportConfig?.label || "Report").slice(0, 31);
  const ws = wb.addWorksheet(sheetName);
  const excelTheme = reportConfig?.exportTheme?.excel || REPORT_EXPORT_THEME.excel;
  const fonts = excelFonts(excelTheme);
  ws.views = [{ state: "normal", showGridLines: excelTheme.showGridLines }];

  const layout = reportConfig?.reportLayout || {};
  const style = reportConfig?.reportStyle || {};
  const columns = payload.columns || reportConfig?.columns || [];
  const colCount = Math.max(columns.length, 1);

  // Logo block — fixed pixel size; see addReportExcelLogo.js.
  let rowIdx = addReportExcelLogo(wb, ws, layout, excelTheme);

  if (layout.companyName) {
    const r = ws.getRow(rowIdx);
    r.getCell(1).value = layout.companyName;
    r.getCell(1).font = {
      ...fonts.tableBold,
      color: { argb: excelTheme.companyNameColor }
    };
    ws.mergeCells(rowIdx, 1, rowIdx, colCount);
    rowIdx++;
  }
  for (const line of layout.headerLines || []) {
    const r = ws.getRow(rowIdx);
    r.getCell(1).value = line;
    r.getCell(1).font = fonts.table;
    ws.mergeCells(rowIdx, 1, rowIdx, colCount);
    rowIdx++;
  }
  if (layout.title) {
    const r = ws.getRow(rowIdx);
    r.getCell(1).value = layout.title;
    r.getCell(1).font = fonts.title;
    ws.mergeCells(rowIdx, 1, rowIdx, colCount);
    rowIdx++;
  }
  if (payload.filterSummary) {
    const r = ws.getRow(rowIdx);
    r.getCell(1).value = payload.filterSummary;
    r.getCell(1).font = fonts.filter;
    r.getCell(1).alignment = excelCellAlignment("left");
    ws.mergeCells(rowIdx, 1, rowIdx, colCount);
    rowIdx++;
  }
  rowIdx++;

  columns.forEach((col, i) => {
    ws.getColumn(i + 1).width = Number(col.widthExcel) || 12;
  });

  const headerFillArgb = (excelTheme.defaultHeaderBackground || "#9DB7C8").replace("#", "FF");
  const headerRow = ws.getRow(rowIdx++);
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.label;
    cell.font = fonts.tableBold;
    cell.alignment = excelCellAlignment("center");
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerFillArgb } };
  });
  applyRowBorders(headerRow, colCount);

  const zebra = style.zebra || excelTheme.defaultZebra;
  const sectionHeaderStyle = style.sectionHeaderRow || {};
  const sectionTotalStyle = style.sectionTotalRow || {};
  const subgroupHeaderStyle = style.subgroupHeaderRow || {};
  const subgroupTotalStyle = style.subgroupTotalRow || {};
  const totalStyle = style.totalRow || {};
  const labelColKey = totalStyle.labelColumn || sectionTotalStyle.labelColumn;
  const labelColIndex = columns.findIndex((c) => c.key === labelColKey);
  const sectionHeaderFillArgb = (sectionHeaderStyle.background || "#c6e6ec").replace("#", "FF");
  const sectionTotalFillArgb = (sectionTotalStyle.background || "#f9f984").replace("#", "FF");
  const subgroupHeaderFillArgb = (subgroupHeaderStyle.background || "#e8f4f7").replace("#", "FF");
  const subgroupTotalFillArgb = (subgroupTotalStyle.background || "#fff7c7").replace("#", "FF");
  const grandTotalFillArgb = (totalStyle.background || excelTheme.defaultTotalBackground).replace("#", "FF");

  function writeDataRow(dataRow, ri, isLastDataRow) {
    const r = ws.getRow(rowIdx++);
    const fillArgb = ri % 2 === 0 ? zebra.even : zebra.odd;
    const argb = fillArgb.replace("#", "FF");
    columns.forEach((col, ci) => {
      const cell = r.getCell(ci + 1);
      cell.value = formatCellValue(col, dataRow[col.key]);
      cell.font = fonts.table;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
      if (col.align === "right") cell.alignment = excelAlignmentForColumn(col, "right");
      else if (col.align === "center") cell.alignment = excelAlignmentForColumn(col, "center");
      else cell.alignment = excelAlignmentForColumn(col, "left");
    });
    applyDataRowBorders(r, colCount, { isLastDataRow });
  }

  function writeSumRow(sumValues, labelText, fillArgb, overrideLabelColKey = null) {
    const r = ws.getRow(rowIdx++);
    const currentLabelColKey = overrideLabelColKey || labelColKey;
    const currentLabelColIndex = columns.findIndex((c) => c.key === currentLabelColKey);
    columns.forEach((col, ci) => {
      const cell = r.getCell(ci + 1);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillArgb } };
      cell.font = fonts.tableBold;
      if (col.sum && sumValues?.[col.key] != null) {
        cell.value = formatCellValue(col, sumValues[col.key]);
        cell.alignment = excelAlignmentForColumn(col, "right");
      } else if (ci === (currentLabelColIndex >= 0 ? currentLabelColIndex : 0)) {
        cell.value = labelText;
        cell.alignment = excelAlignmentForColumn(col, col.align === "right" ? "right" : "left");
      }
    });
    applyRowBorders(r, colCount);
  }

  const groupedSections = payload.groupedSections || [];
  let zebraIndex = 0;

  if (groupedSections.length > 0) {
    const totalDetailRows = groupedSections.reduce(
      (n, s) =>
        n +
        (s.rows?.length || 0) +
        (s.monthGroups || []).reduce((inner, g) => inner + (g.rows?.length || 0), 0),
      0
    );
    for (const section of groupedSections) {
      const headerRow = ws.getRow(rowIdx++);
      const sectionHeaderFill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: sectionHeaderFillArgb }
      };
      for (let ci = 1; ci <= colCount; ci++) {
        const cell = headerRow.getCell(ci);
        if (ci === 1) {
          cell.value = section.headerLabel || section.label || "";
          cell.alignment = excelCellAlignment("left");
        }
        cell.font = fonts.tableBold;
        cell.fill = sectionHeaderFill;
      }
      ws.mergeCells(headerRow.number, 1, headerRow.number, colCount);
      applyRowBorders(headerRow, colCount);

      const sectionRows = section.rows || [];
      for (let ri = 0; ri < sectionRows.length; ri++) {
        const isLast =
          zebraIndex === totalDetailRows - 1 && !columns.some((c) => c.sum) && !payload.grandTotal;
        writeDataRow(sectionRows[ri], zebraIndex, isLast);
        zebraIndex += 1;
      }
      for (const monthGroup of section.monthGroups || []) {
        const subgroupHeaderRow = ws.getRow(rowIdx++);
        for (let ci = 1; ci <= colCount; ci++) {
          const cell = subgroupHeaderRow.getCell(ci);
          if (ci === 1) {
            cell.value = monthGroup.headerLabel || monthGroup.label || "";
            cell.alignment = excelCellAlignment("left");
          }
          cell.font = fonts.tableBold;
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: subgroupHeaderFillArgb } };
        }
        ws.mergeCells(subgroupHeaderRow.number, 1, subgroupHeaderRow.number, colCount);
        applyRowBorders(subgroupHeaderRow, colCount);

        for (const row of monthGroup.rows || []) {
          const isLast =
            zebraIndex === totalDetailRows - 1 && !columns.some((c) => c.sum) && !payload.grandTotal;
          writeDataRow(row, zebraIndex, isLast);
          zebraIndex += 1;
        }
        if (columns.some((c) => c.sum) && monthGroup.subtotal) {
          writeSumRow(
            monthGroup.subtotal,
            subgroupTotalStyle.label || "Subtotal",
            subgroupTotalFillArgb,
            subgroupTotalStyle.labelColumn || labelColKey
          );
        }
      }
      if (columns.some((c) => c.sum) && section.subtotal) {
        writeSumRow(section.subtotal, sectionTotalStyle.label || "Subtotal", sectionTotalFillArgb);
      }
    }
    if (columns.some((c) => c.sum) && payload.grandTotal) {
      writeSumRow(payload.grandTotal, totalStyle.label || "Total", grandTotalFillArgb);
    }
  } else {
    const dataRows = payload.rows || [];
    for (let ri = 0; ri < dataRows.length; ri++) {
      writeDataRow(dataRows[ri], ri, ri === dataRows.length - 1);
    }
    if (columns.some((c) => c.sum) && Object.keys(payload.totals || {}).length > 0) {
      writeSumRow(payload.totals, totalStyle.label || "Total", grandTotalFillArgb);
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
