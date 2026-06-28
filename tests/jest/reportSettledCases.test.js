import { FINAL_CASE_STATUSES, normalizeNciCaseStatusLabel } from "../../lib/modules/newCaseInwardCaseStatus";
import { getYmdISTFromInstant } from "../../lib/istDateTime";
import { getReportConfig } from "../../lib/reportConfig";
import { getReportFilterInitialValues } from "../../lib/reports/reportFilterDefaults";
import { buildSettledCaseStatusWhereSql, buildSettledCasesReportWhereSql } from "../../lib/reports/report_settled_cases";
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

  test("fromDate and toDate default to month start and today", () => {
    const cfg = getReportConfig("report_settled_cases");
    const values = getReportFilterInitialValues(cfg);
    expect(values.fromDate).toMatch(/^\d{4}-\d{2}-01$/);
    expect(values.toDate).toBe(getYmdISTFromInstant(new Date()));
  });

  test("date filters are labeled as settled date range", () => {
    const cfg = getReportConfig("report_settled_cases");
    expect(cfg?.fields?.find((f) => f.name === "fromDate")?.label).toBe("Settled From Date");
    expect(cfg?.fields?.find((f) => f.name === "toDate")?.label).toBe("Settled To Date");
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

describe("buildSettledCasesReportWhereSql", () => {
  test("filters on settled date range, not entrustment date", async () => {
    const { whereSql, values } = await buildSettledCasesReportWhereSql(
      { id: 1, role: 1 },
      { fromDate: "2026-06-01", toDate: "2026-06-30" }
    );
    expect(whereSql).toContain("DATE(nci.caseStatusUpdatedDate) >= ?");
    expect(whereSql).toContain("DATE(nci.caseStatusUpdatedDate) <= ?");
    expect(whereSql).not.toContain("entrustmentDate");
    expect(values).toEqual(expect.arrayContaining(["2026-06-01", "2026-06-30"]));
  });

  test("includes all final statuses except Returned", async () => {
    const { whereSql, values } = await buildSettledCasesReportWhereSql(
      { id: 1, role: 1 },
      { fromDate: "2026-06-01", toDate: "2026-06-30" }
    );
    const status = buildSettledCaseStatusWhereSql();
    expect(whereSql).toContain(status.sql);
    expect(values).not.toContain("returned");
    expect(values).toContain("closed");
    expect(values).toContain("auctioned");
    expect(whereSql).not.toMatch(/amount_recovered|recoveredAmount/i);
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
