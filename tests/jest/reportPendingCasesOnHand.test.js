import { FINAL_CASE_STATUSES } from "../../lib/modules/newCaseInwardCaseStatus";
import { getYmdISTFromInstant } from "../../lib/istDateTime";
import { getReportConfig } from "../../lib/reportConfig";
import { getReportFilterInitialValues } from "../../lib/reports/reportFilterDefaults";
import { buildOpenCaseStatusWhereSql } from "../../lib/reports/report_pending_cases_on_hand";
import { getReportRunner } from "../../lib/reports/reportRegistry";

describe("report_pending_cases_on_hand config", () => {
  test("getReportConfig returns pending cases report with expected columns", () => {
    const cfg = getReportConfig("report_pending_cases_on_hand");
    expect(cfg?.label).toMatch(/Pending Cases on Hand/i);
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
      "caseStatusLabel",
      "amountRecovered",
      "caseStatusRemarks"
    ]);
  });

  test("asOnDate defaults to today in IST", () => {
    const cfg = getReportConfig("report_pending_cases_on_hand");
    const values = getReportFilterInitialValues(cfg);
    expect(values.asOnDate).toBe(getYmdISTFromInstant(new Date()));
    expect(values.outputFormat).toBe("HTML");
  });

  test("closureBalance and amountRecovered are summed in footer", () => {
    const cfg = getReportConfig("report_pending_cases_on_hand");
    const sumKeys = (cfg?.columns || []).filter((c) => c.sum).map((c) => c.key);
    expect(sumKeys).toEqual(["closureBalance", "amountRecovered"]);
  });

  test("runner is registered", () => {
    expect(typeof getReportRunner("report_pending_cases_on_hand")?.runReport).toBe("function");
  });
});

describe("buildOpenCaseStatusWhereSql", () => {
  test("excludes all FINAL_CASE_STATUSES labels", () => {
    const { sql, values } = buildOpenCaseStatusWhereSql();
    expect(sql).toContain("nci.caseStatus IS NULL");
    expect(sql).toContain("NOT IN");
    for (const label of FINAL_CASE_STATUSES) {
      expect(values).toContain(String(label).trim().toLowerCase());
    }
    expect(values).toContain("returned");
    expect(values).toContain("closed");
  });

  test("allows null case status via IS NULL branch", () => {
    const { sql } = buildOpenCaseStatusWhereSql();
    expect(sql).toMatch(/nci\.caseStatus IS NULL/);
  });
});
