import { FINAL_CASE_STATUSES } from "../../lib/modules/newCaseInwardCaseStatus";
import { getReportConfig } from "../../lib/reportConfig";
import { getReportFilterInitialValues } from "../../lib/reports/reportFilterDefaults";
import {
  buildReturnedCaseStatusWhereSql,
  buildReturnedCasesReportWhereSql
} from "../../lib/reports/report_returned_cases";
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

  test("date filters are labeled as return date range", () => {
    const cfg = getReportConfig("report_returned_cases");
    expect(cfg?.fields?.find((f) => f.name === "fromDate")?.label).toBe("Return From Date");
    expect(cfg?.fields?.find((f) => f.name === "toDate")?.label).toBe("Return To Date");
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

describe("buildReturnedCasesReportWhereSql", () => {
  test("filters on return date range, not entrustment date", async () => {
    const { whereSql, values } = await buildReturnedCasesReportWhereSql(
      { id: 1, role: 1 },
      { fromDate: "2026-06-01", toDate: "2026-06-30" }
    );
    expect(whereSql).toContain("DATE(nci.caseStatusUpdatedDate) >= ?");
    expect(whereSql).toContain("DATE(nci.caseStatusUpdatedDate) <= ?");
    expect(whereSql).not.toContain("entrustmentDate");
    expect(values).toEqual(expect.arrayContaining(["2026-06-01", "2026-06-30"]));
  });

  test("includes returned status filter only", async () => {
    const { whereSql, values } = await buildReturnedCasesReportWhereSql(
      { id: 1, role: 1 },
      { fromDate: "2026-06-01", toDate: "2026-06-30" }
    );
    const status = buildReturnedCaseStatusWhereSql();
    expect(whereSql).toContain(status.sql);
    expect(values).toContain("returned");
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
