import { getYmdISTFromInstant } from "../../lib/istDateTime";
import { getReportConfig } from "../../lib/reportConfig";
import { getReportFilterInitialValues } from "../../lib/reports/reportFilterDefaults";
import {
  buildAmountRecoveredGtZeroWhereSql,
  amountRecoveredSubquerySql
} from "../../lib/reports/report_part_recovered_cases";
import { buildOpenCaseStatusWhereSql } from "../../lib/reports/report_pending_cases_on_hand";
import { getReportRunner } from "../../lib/reports/reportRegistry";

describe("report_part_recovered_cases config", () => {
  test("getReportConfig returns part recovered cases with expected columns", () => {
    const cfg = getReportConfig("report_part_recovered_cases");
    expect(cfg?.label).toMatch(/Part Recovered Cases/i);
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
    const cfg = getReportConfig("report_part_recovered_cases");
    const values = getReportFilterInitialValues(cfg);
    expect(values.asOnDate).toBe(getYmdISTFromInstant(new Date()));
  });

  test("closureBalance and amountRecovered are summed in footer", () => {
    const cfg = getReportConfig("report_part_recovered_cases");
    const sumKeys = (cfg?.columns || []).filter((c) => c.sum).map((c) => c.key);
    expect(sumKeys).toEqual(["closureBalance", "amountRecovered"]);
  });

  test("runner is registered", () => {
    expect(typeof getReportRunner("report_part_recovered_cases")?.runReport).toBe("function");
  });
});

describe("report_part_recovered_cases SQL helpers", () => {
  test("buildAmountRecoveredGtZeroWhereSql requires positive recovered total", () => {
    const { sql } = buildAmountRecoveredGtZeroWhereSql();
    expect(sql).toContain("> 0");
    expect(sql).toContain("new_case_inward_amount_recovered");
  });

  test("amountRecoveredSubquerySql sums per caseInwardId", () => {
    expect(amountRecoveredSubquerySql()).toMatch(/SUM\(ar\.recoveredAmount\)/);
    expect(amountRecoveredSubquerySql()).toMatch(/caseInwardId = nci\.id/);
  });

  test("open case filter reuses pending cases helper", () => {
    const { sql } = buildOpenCaseStatusWhereSql();
    expect(sql).toContain("NOT IN");
  });
});
