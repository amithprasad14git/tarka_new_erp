// Test file — Excel workbook builder (smoke).

let exceljsAvailable = true;
try {
  require.resolve("exceljs");
} catch {
  exceljsAvailable = false;
}

const maybe = exceljsAvailable ? describe : describe.skip;

maybe("buildReportWorkbook", () => {
  test("excelCellAlignment enables wrap text", async () => {
    const { excelCellAlignment } = await import("../../lib/reports/buildReportWorkbook");
    expect(excelCellAlignment("center")).toEqual({
      horizontal: "center",
      vertical: "middle",
      wrapText: true
    });
  });

  test("returns a non-empty buffer", async () => {
    const { buildReportWorkbook } = await import("../../lib/reports/buildReportWorkbook");
    const config = {
      label: "Test",
      reportLayout: { title: "T", companyName: "Co" },
      reportStyle: { totalRow: { labelColumn: "a" } },
      columns: [
        { key: "a", label: "A", widthExcel: 10 },
        { key: "amount", label: "Amt", type: "inr", sum: true, widthExcel: 12, align: "right" }
      ]
    };
    const buf = await buildReportWorkbook(config, {
      rows: [{ a: 1, amount: 100 }],
      totals: { amount: 100 },
      filterSummary: "From Date: All"
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(100);
  });
});
