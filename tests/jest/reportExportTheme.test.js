import { REPORT_EXPORT_THEME, getReportHtmlCssVars } from "../../config/reportExportTheme";

/** Frozen theme contract — update alongside docs/REPORTS.md when styling changes. */
describe("report export theme (frozen v1)", () => {
  test("normal html font preset snapshot", () => {
    expect(getReportHtmlCssVars("normal")).toEqual({
      "--report-title-font-size": "calc(1.25rem - 1pt)",
      "--report-filter-font-size": "calc(0.95rem - 1pt)",
      "--report-table-font-size": "calc(0.75rem - 1pt)",
      "--report-table-header-font-size": "calc(0.7rem)",
      "--report-table-footer-font-size": "calc(0.75rem)",
      "--report-logo-max-height": "58px",
      "--report-scroll-max-height": "min(78vh, 40rem)"
    });
  });

  test("html font presets small and large", () => {
    expect(getReportHtmlCssVars("small")["--report-table-font-size"]).toBe("calc(0.65rem - 1pt)");
    expect(getReportHtmlCssVars("large")["--report-table-font-size"]).toBe("calc(0.85rem - 1pt)");
  });

  test("unknown preset falls back to normal", () => {
    expect(getReportHtmlCssVars("invalid")["--report-table-font-size"]).toBe("calc(0.75rem - 1pt)");
  });

  test("excel theme snapshot", () => {
    expect(REPORT_EXPORT_THEME.excel).toMatchObject({
      fontSize: 9,
      titleFontSize: 12,
      filterFontSize: 10,
      logoExtHeight: 58,
      logoExtWidth: 396,
      logoEndCol: 4.98,
      showGridLines: false,
      defaultZebra: { even: "#ffffff", odd: "#F0F4F8" },
      defaultTotalBackground: "#9FD4AD",
      defaultHeaderBackground: "#9DB7C8"
    });
  });

  test("zebra and total row colours snapshot", () => {
    expect(REPORT_EXPORT_THEME.reportStyle.zebra).toEqual({ even: "#ffffff", odd: "#F0F4F8" });
    expect(REPORT_EXPORT_THEME.reportStyle.totalRow.background).toBe("#9FD4AD");
    expect(REPORT_EXPORT_THEME.reportStyle.tableHeaderBackground).toBe("#9DB7C8");
  });
});
