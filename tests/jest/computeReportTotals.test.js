// Test file — report column totals.

import { computeReportTotals } from "../../lib/reports/computeReportTotals";

describe("computeReportTotals", () => {
  test("sums columns marked sum: true", () => {
    const columns = [
      { key: "a", label: "A" },
      { key: "amount", label: "Amt", sum: true, type: "inr" }
    ];
    const rows = [{ a: 1, amount: 100 }, { a: 2, amount: 250.5 }];
    const totals = computeReportTotals(columns, rows);
    expect(totals.amount).toBe(350.5);
  });
});
