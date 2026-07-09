// Test file — Region Wise Cummulative custom report config and grouping helpers.

import { getReportConfig } from "../../lib/reportConfig";
import { getReportRunner } from "../../lib/reports/reportRegistry";
import { groupRegionWiseCumulativeRows } from "../../lib/reports/groupRegionWiseCumulativeRows";
import { formatFinancialYearRangeLabel } from "../../lib/reports/formatFinancialYearRange";
import { isKnownCustomRenderer } from "../../lib/reports/customRendererMap";

describe("report_region_wise_cumulative_report config", () => {
  test("getReportConfig returns custom layout report", () => {
    const cfg = getReportConfig("report_region_wise_cumulative_report");
    expect(cfg?.label).toMatch(/Region Wise Cummulative Report/i);
    expect(cfg?.reportLayout?.mode).toBe("custom");
    expect(cfg?.reportLayout?.customRenderer).toBe("region_wise_cumulative");
    expect(cfg?.reportLayout?.contentAlign).toBe("center");
    expect(cfg?.reportLayout?.showGeneratedAt).toBe(true);
    expect(cfg?.reportLayout?.showOutputMeta).not.toBe(false);
    expect(cfg?.columns).toBeUndefined();
    expect(cfg?.fields?.find((f) => f.name === "financialYear")?.required).toBe(true);
  });

  test("filter summary excludes financial year and output format", () => {
    const cfg = getReportConfig("report_region_wise_cumulative_report");
    expect(cfg?.reportLayout?.filterSummaryExcludeFields).toEqual(["outputFormat", "financialYear"]);
  });

  test("runner is registered with custom workbook builder", () => {
    const runner = getReportRunner("report_region_wise_cumulative_report");
    expect(typeof runner?.runReport).toBe("function");
    expect(typeof runner?.buildCustomWorkbook).toBe("function");
  });

  test("custom renderer id is known", () => {
    expect(isKnownCustomRenderer("region_wise_cumulative")).toBe(true);
  });
});

describe("groupRegionWiseCumulativeRows", () => {
  test("groups flat rows into sections with subtotals and grand total", () => {
    const raw = [
      {
        rbo_ro_id: 1,
        rbo_ro: "RBO-A",
        loan_category: "Housing",
        no_of_cases: 2,
        amount_recovered: 1000.5,
        npa_reduced: 500.25
      },
      {
        rbo_ro_id: 1,
        rbo_ro: "RBO-A",
        loan_category: "Vehicle",
        no_of_cases: 1,
        amount_recovered: 200,
        npa_reduced: 100
      },
      {
        rbo_ro_id: 2,
        rbo_ro: "RBO-B",
        loan_category: "Housing",
        no_of_cases: 3,
        amount_recovered: 300,
        npa_reduced: 150
      }
    ];

    const { sections, grandTotal } = groupRegionWiseCumulativeRows(raw);
    expect(sections).toHaveLength(2);
    expect(sections[0].regionLabel).toBe("RBO-A");
    expect(sections[0].details).toHaveLength(2);
    expect(sections[0].subtotal).toEqual({ caseCount: 3, cashRecovered: 1200.5, npaReduced: 600.25 });
    expect(sections[1].subtotal.caseCount).toBe(3);
    expect(grandTotal).toEqual({ caseCount: 6, cashRecovered: 1500.5, npaReduced: 750.25 });
  });
});

describe("formatFinancialYearRangeLabel", () => {
  test("formats start and end years", () => {
    expect(formatFinancialYearRangeLabel("2026-04-01", "2027-03-31")).toBe("2026 - 2027");
  });
});
