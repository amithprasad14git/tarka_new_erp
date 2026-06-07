// Test file — Unit Wise Cummulative custom report config and grouping helpers.

import { getReportConfig } from "../../lib/reportConfig";
import { getReportRunner } from "../../lib/reports/reportRegistry";
import { groupCumulativeReportRows, sumCumulativeMetrics } from "../../lib/reports/groupCumulativeReportRows";
import { isKnownCustomRenderer } from "../../lib/reports/customRendererMap";

describe("report_unit_wise_cumulative_report config", () => {
  test("getReportConfig returns custom layout report with dataType filter", () => {
    const cfg = getReportConfig("report_unit_wise_cumulative_report");
    expect(cfg?.label).toMatch(/Unit Wise Cummulative Report/i);
    expect(cfg?.reportLayout?.mode).toBe("custom");
    expect(cfg?.reportLayout?.customRenderer).toBe("unit_wise_cumulative");
    expect(cfg?.reportLayout?.contentAlign).toBe("center");
    expect(cfg?.reportLayout?.showGeneratedAt).toBe(false);
    expect(cfg?.reportLayout?.showOutputMeta).toBe(false);
    expect(cfg?.columns).toBeUndefined();
    expect(cfg?.fields?.find((f) => f.name === "financialYear")?.required).toBe(true);

    const dataType = cfg?.fields?.find((f) => f.name === "dataType");
    expect(dataType?.default).toBe("Month Wise");
    expect(dataType?.options?.map((o) => o.value)).toEqual(["Month Wise", "Summary"]);
  });

  test("filter summary excludes financial year and output format", () => {
    const cfg = getReportConfig("report_unit_wise_cumulative_report");
    expect(cfg?.reportLayout?.filterSummaryExcludeFields).toEqual(["outputFormat", "financialYear"]);
  });

  test("runner is registered with custom workbook builder", () => {
    const runner = getReportRunner("report_unit_wise_cumulative_report");
    expect(typeof runner?.runReport).toBe("function");
    expect(typeof runner?.buildCustomWorkbook).toBe("function");
  });

  test("custom renderer id is known", () => {
    expect(isKnownCustomRenderer("unit_wise_cumulative")).toBe(true);
  });
});

describe("groupCumulativeReportRows (Unit Wise Month Wise)", () => {
  test("groups flat rows by month and unit with subtotals and grand total", () => {
    const raw = [
      {
        month_key: "2026-04",
        month_label: "April-2026",
        unit_id: 1,
        unit_label: "Unit 1",
        no_of_cases: 2,
        amount_recovered: 1000,
        npa_reduced: 500
      },
      {
        month_key: "2026-04",
        month_label: "April-2026",
        unit_id: 2,
        unit_label: "Unit 2",
        no_of_cases: 1,
        amount_recovered: 200,
        npa_reduced: 100
      },
      {
        month_key: "2026-05",
        month_label: "May-2026",
        unit_id: 1,
        unit_label: "Unit 1",
        no_of_cases: 3,
        amount_recovered: 300,
        npa_reduced: 150
      }
    ];

    const { sections, grandTotal } = groupCumulativeReportRows(raw, {
      sectionIdKey: "month_key",
      sectionLabelKey: "month_label",
      detailLabelKey: "unit_label"
    });

    expect(sections).toHaveLength(2);
    expect(sections[0].sectionLabel).toBe("April-2026");
    expect(sections[0].details).toHaveLength(2);
    expect(sections[0].subtotal).toEqual({ caseCount: 3, cashRecovered: 1200, npaReduced: 600 });
    expect(sections[1].sectionLabel).toBe("May-2026");
    expect(grandTotal).toEqual({ caseCount: 6, cashRecovered: 1500, npaReduced: 750 });
  });
});

describe("sumCumulativeMetrics (Unit Wise Summary)", () => {
  test("sums row metrics for totals row", () => {
    const rows = [
      { caseCount: 2, cashRecovered: 100, npaReduced: 50 },
      { caseCount: 3, cashRecovered: 200, npaReduced: 75 }
    ];
    expect(sumCumulativeMetrics(rows)).toEqual({ caseCount: 5, cashRecovered: 300, npaReduced: 125 });
  });
});
