// Test file — report filter validation.

import { validateReportFilters, filtersForQuery } from "../../lib/reports/reportFilterValidation";

const sampleConfig = {
  fields: [
    { name: "fromDate", type: "date", label: "From", required: true, maxToday: true },
    { name: "toDate", type: "date", label: "To", required: true, maxToday: true },
    {
      name: "outputFormat",
      type: "select",
      label: "Report Type",
      required: true,
      options: [
        { label: "HTML", value: "HTML" },
        { label: "Excel", value: "Excel" }
      ]
    }
  ]
};

describe("reportFilterValidation", () => {
  test("rejects missing required dates", () => {
    const err = validateReportFilters(sampleConfig, { outputFormat: "HTML" });
    expect(err).toBeTruthy();
  });

  test("filtersForQuery strips outputFormat", () => {
    const q = filtersForQuery({
      fromDate: "2026-06-01",
      toDate: "2026-06-30",
      outputFormat: "HTML"
    });
    expect(q.outputFormat).toBeUndefined();
    expect(q.fromDate).toBe("2026-06-01");
  });
});

