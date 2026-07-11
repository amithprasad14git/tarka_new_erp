// Test file — Excel report logo placement (fixed pixel size).

import ExcelJS from "exceljs";
import { addReportExcelLogo } from "../../lib/reports/addReportExcelLogo";
import { REPORT_EXPORT_THEME } from "../../config/reportExportTheme";

describe("addReportExcelLogo", () => {
  test("reserves logo row block and uses fixed ext dimensions in theme", () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Test");
    const nextRow = addReportExcelLogo(wb, ws, {
      showLogo: true,
      logoPath: "/images/npa_full_transparent_bg.png"
    }, REPORT_EXPORT_THEME.excel);

    expect(nextRow).toBe(3);
    expect(REPORT_EXPORT_THEME.excel.logoExtHeight).toBe(58);
    expect(REPORT_EXPORT_THEME.excel.logoExtWidth).toBe(396);
    expect(ws.getRow(1).height).toBe(34);
    expect(ws.getRow(2).height).toBe(24);
  });

  test("skips logo when showLogo is false", () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Test");
    const nextRow = addReportExcelLogo(wb, ws, { showLogo: false }, REPORT_EXPORT_THEME.excel);
    expect(nextRow).toBe(1);
  });
});

