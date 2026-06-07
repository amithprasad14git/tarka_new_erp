import { FINAL_CASE_STATUSES, normalizeNciCaseStatusLabel } from "../../lib/modules/newCaseInwardCaseStatus";
import { getReportConfig } from "../../lib/reportConfig";
import { getReportFilterInitialValues } from "../../lib/reports/reportFilterDefaults";
import { buildSettledCaseStatusWhereSql } from "../../lib/reports/report_settled_cases";
import { getReportRunner } from "../../lib/reports/reportRegistry";

describe("report_settled_cases config", () => {
  test("getReportConfig returns settled cases with expected columns", () => {
    const cfg = getReportConfig("report_settled_cases");
    expect(cfg?.label).toMatch(/Settled Cases/i);
    expect(cfg?.columns?.map((c) => c.key)).toEqual([
      "slNo",
      "entrustmentDate",
      "caseNo",
      "hoZoLabel",
      "rboRoLabel",
      "branchLabel",
      "receivedFromLabel",
      "borrower",
      "loanAccountNo",
      "loanTypeLabel",
      "npaStatusLabel",
      "npaDate",
      "amountRecovered",
      "closureBalance",
      "settledDate",
      "caseStatusLabel"
    ]);
  });

  test("fromDate and toDate default to month start/end", () => {
    const cfg = getReportConfig("report_settled_cases");
    const values = getReportFilterInitialValues(cfg);
    expect(values.fromDate).toMatch(/^\d{4}-\d{2}-01$/);
    expect(values.toDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("closureBalance and amountRecovered are summed in footer", () => {
    const cfg = getReportConfig("report_settled_cases");
    const sumKeys = (cfg?.columns || []).filter((c) => c.sum).map((c) => c.key);
    expect(sumKeys).toEqual(["amountRecovered", "closureBalance"]);
  });

  test("runner is registered", () => {
    expect(typeof getReportRunner("report_settled_cases")?.runReport).toBe("function");
  });
});

describe("buildSettledCaseStatusWhereSql", () => {
  test("includes all FINAL_CASE_STATUSES except Returned", () => {
    const { sql, values } = buildSettledCaseStatusWhereSql();
    expect(sql).toContain("IN (");
    expect(values).not.toContain("returned");
    for (const label of FINAL_CASE_STATUSES) {
      const norm = normalizeNciCaseStatusLabel(label);
      if (norm === "returned") {
        expect(values).not.toContain(norm);
      } else {
        expect(values).toContain(norm);
      }
    }
  });
});
