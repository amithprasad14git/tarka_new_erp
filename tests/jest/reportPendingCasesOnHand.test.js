// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `reportPendingCasesOnHand`.
 * Run with: npm test
 */

import { FINAL_CASE_STATUSES } from "../../lib/modules/newCaseInwardCaseStatus";
import { getYmdISTFromInstant } from "../../lib/istDateTime";
import { getReportConfig } from "../../lib/reportConfig";
import { getReportFilterInitialValues } from "../../lib/reports/reportFilterDefaults";
import {
  buildOpenCaseStatusWhereSql,
  buildSummaryAggregatedSql,
  normalizePendingCasesDataType,
  PENDING_CASES_DATA_TYPE_DETAILED,
  PENDING_CASES_DATA_TYPE_SUMMARY
} from "../../lib/reports/report_pending_cases_on_hand";
import { getReportRunner } from "../../lib/reports/reportRegistry";
import { resolveVisibleReportColumns } from "../../lib/reports/resolveVisibleReportColumns";

describe("report_pending_cases_on_hand config", () => {
  test("getReportConfig returns pending cases report with dataType and dual-mode columns", () => {
    const cfg = getReportConfig("report_pending_cases_on_hand");
    expect(cfg?.label).toMatch(/Pending Cases on Hand/i);
    const dataType = cfg?.fields?.find((f) => f.name === "dataType");
    expect(dataType?.default).toBe("Detailed");
    expect(dataType?.options?.map((o) => o.value)).toEqual(["Detailed", "Summary"]);
    expect(cfg?.reportStyle?.totalRow?.labelColumn).toBe("slNo");
    expect(cfg?.columns?.map((c) => c.key)).toEqual([
      "slNo",
      "rboRoLabel",
      "branchLabel",
      "caseCount",
      "amountRecovered",
      "closureBalance",
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

  test("asOnDate and dataType defaults", () => {
    const cfg = getReportConfig("report_pending_cases_on_hand");
    const values = getReportFilterInitialValues(cfg);
    expect(values.asOnDate).toBe(getYmdISTFromInstant(new Date()));
    expect(values.dataType).toBe("Detailed");
    expect(values.outputFormat).toBe("HTML");
  });

  test("sum columns include caseCount and amounts", () => {
    const cfg = getReportConfig("report_pending_cases_on_hand");
    const sumKeys = (cfg?.columns || []).filter((c) => c.sum).map((c) => c.key);
    expect(sumKeys).toEqual(["caseCount", "amountRecovered", "closureBalance", "closureBalance", "amountRecovered"]);
  });

  test("runner is registered", () => {
    expect(typeof getReportRunner("report_pending_cases_on_hand")?.runReport).toBe("function");
  });
});

describe("normalizePendingCasesDataType", () => {
  test("defaults to Detailed", () => {
    expect(normalizePendingCasesDataType(undefined)).toBe(PENDING_CASES_DATA_TYPE_DETAILED);
    expect(normalizePendingCasesDataType("")).toBe(PENDING_CASES_DATA_TYPE_DETAILED);
    expect(normalizePendingCasesDataType("Detailed")).toBe(PENDING_CASES_DATA_TYPE_DETAILED);
  });

  test("recognizes Summary", () => {
    expect(normalizePendingCasesDataType("Summary")).toBe(PENDING_CASES_DATA_TYPE_SUMMARY);
    expect(normalizePendingCasesDataType("  Summary  ")).toBe(PENDING_CASES_DATA_TYPE_SUMMARY);
  });
});

describe("buildSummaryAggregatedSql", () => {
  test("aggregates by RBO and Branch", () => {
    const sql = buildSummaryAggregatedSql();
    expect(sql).toContain("GROUP BY b.rbo_ro_id, b.rbo_ro_label, b.branch_id, b.branch_label");
    expect(sql).toContain("rbo.shortCode AS rbo_ro_label");
    expect(sql).toContain("SUM(b.no_of_cases) AS case_count");
    expect(sql).toContain("SUM(b.amount_recovered) AS amount_recovered");
    expect(sql).toContain("SUM(b.closure_balance) AS closure_balance");
    expect(sql).toContain("ORDER BY b.rbo_ro_label, b.branch_label");
    expect(sql).not.toContain("entrustmentDate");
  });
});

describe("resolveVisibleReportColumns hideWhenDataType", () => {
  test("Detailed keeps case-level columns and hides summary-only keys", () => {
    const cfg = getReportConfig("report_pending_cases_on_hand");
    const visible = resolveVisibleReportColumns(cfg.columns, cfg.fields, {
      dataType: "Detailed"
    });
    const keys = visible.map((c) => c.key);
    expect(keys).toEqual([
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
    expect(keys).not.toContain("caseCount");
  });

  test("Summary shows RBO, Branch, case count, amounts only", () => {
    const cfg = getReportConfig("report_pending_cases_on_hand");
    const visible = resolveVisibleReportColumns(cfg.columns, cfg.fields, {
      dataType: "Summary"
    });
    expect(visible.map((c) => c.key)).toEqual([
      "slNo",
      "rboRoLabel",
      "branchLabel",
      "caseCount",
      "amountRecovered",
      "closureBalance"
    ]);
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
