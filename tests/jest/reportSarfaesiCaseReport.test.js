import { getYmdISTFromInstant } from "../../lib/istDateTime";
import { getReportConfig } from "../../lib/reportConfig";
import { getReportFilterInitialValues } from "../../lib/reports/reportFilterDefaults";
import { isKnownCustomRenderer } from "../../lib/reports/customRendererMap";
import { countCustomReportRows } from "../../lib/reports/countCustomReportRows";
import { getReportRunner } from "../../lib/reports/reportRegistry";
import {
  buildSarfaesiLoanCategoryWhereSql,
  mapSarfaesiDetailsByUpdateId
} from "../../lib/reports/report_sarfaesi_case_report";

describe("report_sarfaesi_case_report config", () => {
  test("getReportConfig returns custom layout report", () => {
    const cfg = getReportConfig("report_sarfaesi_case_report");
    expect(cfg?.label).toMatch(/SARFAESI Case Report/i);
    expect(cfg?.reportLayout?.mode).toBe("custom");
    expect(cfg?.reportLayout?.customRenderer).toBe("sarfaesi_case_report");
    expect(cfg?.reportLayout?.title).toBe("SARFAESI CASE STATUS REPORT");
    expect(cfg?.reportLayout?.showGeneratedAt).toBe(false);
    expect(cfg?.reportLayout?.showOutputMeta).toBe(false);
    expect(cfg?.columns).toBeUndefined();
    expect(cfg?.fields?.find((f) => f.name === "asOnDate")?.required).toBe(true);
  });

  test("asOnDate defaults to today in IST", () => {
    const cfg = getReportConfig("report_sarfaesi_case_report");
    const values = getReportFilterInitialValues(cfg);
    expect(values.asOnDate).toBe(getYmdISTFromInstant(new Date()));
    expect(values.outputFormat).toBe("HTML");
  });

  test("filter summary excludes output format", () => {
    const cfg = getReportConfig("report_sarfaesi_case_report");
    expect(cfg?.reportLayout?.filterSummaryExcludeFields).toEqual(["outputFormat"]);
  });

  test("runner is registered with custom workbook builder", () => {
    const runner = getReportRunner("report_sarfaesi_case_report");
    expect(typeof runner?.runReport).toBe("function");
    expect(typeof runner?.buildCustomWorkbook).toBe("function");
  });

  test("custom renderer id is known", () => {
    expect(isKnownCustomRenderer("sarfaesi_case_report")).toBe(true);
  });
});

describe("buildSarfaesiLoanCategoryWhereSql", () => {
  test("restricts to SARFAESI loan category lookup", () => {
    const { sql, values } = buildSarfaesiLoanCategoryWhereSql();
    expect(sql).toContain("nci.loanCategory IN");
    expect(sql).toContain("lookup_value_master");
    expect(values).toEqual(["Loan Category", "SARFAESI"]);
  });
});

describe("mapSarfaesiDetailsByUpdateId", () => {
  test("groups remarks by sarfaesi update id and particulars id", () => {
    const map = mapSarfaesiDetailsByUpdateId([
      { sarfaesiUpdateId: 10, particularsId: 1, remarks: "03/10/2025" },
      { sarfaesiUpdateId: 10, particularsId: 2, remarks: "Published" },
      { sarfaesiUpdateId: 20, particularsId: 1, remarks: "Note" }
    ]);
    expect(map.get(10)).toEqual({ 1: "03/10/2025", 2: "Published" });
    expect(map.get(20)).toEqual({ 1: "Note" });
  });
});

describe("countCustomReportRows", () => {
  test("counts custom.cases for SARFAESI payload", () => {
    expect(countCustomReportRows({ cases: [{ slNo: 1 }, { slNo: 2 }] })).toBe(2);
  });
});
