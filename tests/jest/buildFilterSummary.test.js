// Test file — filter summary shows only selected filters.

import { buildFilterSummaryText } from "../../lib/reports/buildFilterSummary";

describe("buildFilterSummaryText", () => {
  const config = {
    fields: [
      { name: "fromDate", label: "From Date", type: "date" },
      { name: "toDate", label: "To Date", type: "date" },
      { name: "bank", label: "Bank", type: "lookup" },
      { name: "outputFormat", label: "Report Type" }
    ],
    reportLayout: { filterSummaryExcludeFields: ["outputFormat"] }
  };

  test("omits empty optional filters", () => {
    const text = buildFilterSummaryText(
      config,
      { fromDate: "2026-06-01", toDate: "2026-06-30", bank: "" },
      {}
    );
    expect(text).toContain("From Date:");
    expect(text).toContain("To Date:");
    expect(text).not.toContain("Bank:");
    expect(text).not.toContain("All");
  });

  test("includes lookup label when provided", () => {
    const text = buildFilterSummaryText(
      config,
      { fromDate: "2026-06-01", toDate: "2026-06-30", bank: "5" },
      { bank: "Sample Bank" }
    );
    expect(text).toContain("Bank: Sample Bank");
  });

  test("omits lookup filter when label is missing", () => {
    const text = buildFilterSummaryText(
      config,
      { fromDate: "2026-06-01", toDate: "2026-06-30", bank: "5" },
      {}
    );
    expect(text).not.toContain("Bank:");
    expect(text).not.toContain(": 5");
  });
});
