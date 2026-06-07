import { FINAL_CASE_STATUSES } from "../../lib/modules/newCaseInwardCaseStatus";
import { getReportConfig } from "../../lib/reportConfig";
import { getReportFilterInitialValues } from "../../lib/reports/reportFilterDefaults";
import { buildReturnedCaseStatusWhereSql } from "../../lib/reports/report_returned_cases";
import { getReportRunner } from "../../lib/reports/reportRegistry";

describe("report_returned_cases config", () => {
  test("getReportConfig returns returned cases with expected columns", () => {
    const cfg = getReportConfig("report_returned_cases");
    expect(cfg?.label).toMatch(/Returned Cases/i);
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
      "closureBalance",
      "amountRecovered",
      "returnDate",
      "caseStatusRemarks"
    ]);
  });

  test("fromDate and toDate default to month start/end", () => {
    const cfg = getReportConfig("report_returned_cases");
    const values = getReportFilterInitialValues(cfg);
    expect(values.fromDate).toMatch(/^\d{4}-\d{2}-01$/);
    expect(values.toDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(values.outputFormat).toBe("HTML");
  });

  test("closureBalance and amountRecovered are summed in footer", () => {
    const cfg = getReportConfig("report_returned_cases");
    const sumKeys = (cfg?.columns || []).filter((c) => c.sum).map((c) => c.key);
    expect(sumKeys).toEqual(["closureBalance", "amountRecovered"]);
  });

  test("runner is registered", () => {
    expect(typeof getReportRunner("report_returned_cases")?.runReport).toBe("function");
  });
});

describe("buildReturnedCaseStatusWhereSql", () => {
  test("filters only Returned status from FINAL_CASE_STATUSES", () => {
    expect(FINAL_CASE_STATUSES).toContain("Returned");
    const { sql, values } = buildReturnedCaseStatusWhereSql();
    expect(sql).toContain("LOWER(TRIM(cs.lookupValue)) = ?");
    expect(values).toEqual(["returned"]);
  });
});
