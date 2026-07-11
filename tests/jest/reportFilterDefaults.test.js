// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `reportFilterDefaults`.
 * Run with: npm test
 */

import { getReportFilterInitialValues } from "../../lib/reports/reportFilterDefaults";
import { getReportConfig } from "../../lib/reportConfig";

describe("getReportFilterInitialValues", () => {
  test("branch register active defaults to empty (Select One)", () => {
    const cfg = getReportConfig("report_branch_register");
    const values = getReportFilterInitialValues(cfg);
    expect(values.active).toBe("");
    expect(values.outputFormat).toBe("HTML");
  });
});

