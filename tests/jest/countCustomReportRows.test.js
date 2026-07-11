// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `countCustomReportRows`.
 * Run with: npm test
 */

import { countCustomReportRows } from "../../lib/reports/countCustomReportRows";

describe("countCustomReportRows", () => {
  test("counts flat summary rows", () => {
    expect(countCustomReportRows({ rows: [{}, {}, {}] })).toBe(3);
  });

  test("counts banded section detail rows", () => {
    expect(
      countCustomReportRows({
        sections: [{ details: [{}, {}] }, { details: [{}] }]
      })
    ).toBe(3);
  });

  test("returns 0 for empty custom payload", () => {
    expect(countCustomReportRows(null)).toBe(0);
    expect(countCustomReportRows({})).toBe(0);
  });
});

