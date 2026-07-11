// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `reportSettledCases`.
 * Run with: npm test
 */

import { FINAL_CASE_STATUSES, normalizeNciCaseStatusLabel } from "../../lib/modules/newCaseInwardCaseStatus";
import { getYmdISTFromInstant } from "../../lib/istDateTime";
import { getReportConfig } from "../../lib/reportConfig";
import { getReportFilterInitialValues } from "../../lib/reports/reportFilterDefaults";
import {
  buildSettledCaseStatusWhereSql,
  buildSettledCasesReportWhereSql,
  buildSummaryAggregatedSql,
  normalizeSettledCasesDataType,
  SETTLED_CASES_DATA_TYPE_DETAILED,
  SETTLED_CASES_DATA_TYPE_SUMMARY
} from "../../lib/reports/report_settled_cases";
import { getReportRunner } from "../../lib/reports/reportRegistry";
import { resolveVisibleReportColumns } from "../../lib/reports/resolveVisibleReportColumns";

describe("report_settled_cases config", () => {
  test("getReportConfig returns settled cases with expected columns", () => {
    const cfg = getReportConfig("report_settled_cases");
    expect(cfg?.label).toMatch(/Settled Cases/i);
    expect(cfg?.columns?.map((c) => c.key)).toEqual([
      "slNo",
      "bankLabel",
      "rboRoLabel",
      "caseCount",
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

  test("dataType filter defaults to Detailed and appears before outputFormat", () => {
    const cfg = getReportConfig("report_settled_cases");
    const fieldNames = (cfg?.fields || []).map((f) => f.name);
    const dataTypeIdx = fieldNames.indexOf("dataType");
    const outputFormatIdx = fieldNames.indexOf("outputFormat");
    expect(dataTypeIdx).toBeGreaterThan(-1);
    expect(outputFormatIdx).toBeGreaterThan(dataTypeIdx);
    expect(cfg?.fields?.find((f) => f.name === "dataType")?.default).toBe("Detailed");
  });

  test("fromDate and toDate default to month start and today", () => {
    const cfg = getReportConfig("report_settled_cases");
    const values = getReportFilterInitialValues(cfg);
    expect(values.fromDate).toMatch(/^\d{4}-\d{2}-01$/);
    expect(values.toDate).toBe(getYmdISTFromInstant(new Date()));
    expect(values.dataType).toBe("Detailed");
  });

  test("date filters are labeled as settled date range", () => {
    const cfg = getReportConfig("report_settled_cases");
    expect(cfg?.fields?.find((f) => f.name === "fromDate")?.label).toBe("Settled From Date");
    expect(cfg?.fields?.find((f) => f.name === "toDate")?.label).toBe("Settled To Date");
  });

  test("footer total label column is slNo", () => {
    const cfg = getReportConfig("report_settled_cases");
    expect(cfg?.reportStyle?.totalRow?.labelColumn).toBe("slNo");
  });

  test("Detailed mode sums amountRecovered, closureBalance; Summary also sums caseCount", () => {
    const cfg = getReportConfig("report_settled_cases");
    const sumKeys = (cfg?.columns || []).filter((c) => c.sum).map((c) => c.key);
    expect(sumKeys).toEqual(["caseCount", "amountRecovered", "closureBalance"]);
  });

  test("runner is registered", () => {
    expect(typeof getReportRunner("report_settled_cases")?.runReport).toBe("function");
  });
});

describe("normalizeSettledCasesDataType", () => {
  test("defaults to Detailed", () => {
    expect(normalizeSettledCasesDataType(undefined)).toBe(SETTLED_CASES_DATA_TYPE_DETAILED);
    expect(normalizeSettledCasesDataType("")).toBe(SETTLED_CASES_DATA_TYPE_DETAILED);
    expect(normalizeSettledCasesDataType("Detailed")).toBe(SETTLED_CASES_DATA_TYPE_DETAILED);
  });

  test("recognizes Summary", () => {
    expect(normalizeSettledCasesDataType("Summary")).toBe(SETTLED_CASES_DATA_TYPE_SUMMARY);
    expect(normalizeSettledCasesDataType("  Summary  ")).toBe(SETTLED_CASES_DATA_TYPE_SUMMARY);
  });
});

describe("buildSummaryAggregatedSql", () => {
  test("aggregates by bank and RBO with settled-case metrics", () => {
    const sql = buildSummaryAggregatedSql();
    expect(sql).toContain("GROUP BY b.bank_id, b.bank_label, b.rbo_ro_id, b.rbo_ro_label");
    expect(sql).toContain("bank.bankCode AS bank_label");
    expect(sql).toContain("rbo.shortCode AS rbo_ro_label");
    expect(sql).toContain("SUM(b.no_of_cases) AS case_count");
    expect(sql).toContain("SUM(b.amount_recovered) AS amount_recovered");
    expect(sql).toContain("SUM(b.npa_reduced) AS npa_reduced");
    expect(sql).not.toContain("entrustmentDate");
    expect(sql).not.toMatch(/amount_recovered > 0/);
  });
});

describe("resolveVisibleReportColumns hideWhenDataType", () => {
  test("Detailed hides summary bank/rbo/count columns", () => {
    const cfg = getReportConfig("report_settled_cases");
    const visible = resolveVisibleReportColumns(cfg.columns, cfg.fields, {
      dataType: "Detailed"
    });
    const keys = visible.map((c) => c.key);
    expect(keys).not.toContain("bankLabel");
    expect(keys).not.toContain("caseCount");
    expect(keys).toContain("entrustmentDate");
    expect(keys).toContain("caseNo");
    expect(keys).toContain("amountRecovered");
    expect(keys).toContain("closureBalance");
  });

  test("Summary hides case-level columns", () => {
    const cfg = getReportConfig("report_settled_cases");
    const visible = resolveVisibleReportColumns(cfg.columns, cfg.fields, {
      dataType: "Summary"
    });
    const keys = visible.map((c) => c.key);
    expect(keys).toContain("bankLabel");
    expect(keys).toContain("rboRoLabel");
    expect(keys).toContain("caseCount");
    expect(keys).not.toContain("entrustmentDate");
    expect(keys).not.toContain("caseNo");
    expect(keys).not.toContain("borrower");
    expect(keys).toContain("amountRecovered");
    expect(keys).toContain("closureBalance");
  });
});

describe("buildSettledCasesReportWhereSql", () => {
  test("filters on settled date range, not entrustment date", async () => {
    const { whereSql, values } = buildSettledCasesReportWhereSql(
      { fromDate: "2026-06-01", toDate: "2026-06-30" }
    );
    expect(whereSql).toContain("DATE(nci.caseStatusUpdatedDate) >= ?");
    expect(whereSql).toContain("DATE(nci.caseStatusUpdatedDate) <= ?");
    expect(whereSql).not.toContain("entrustmentDate");
    expect(values).toEqual(expect.arrayContaining(["2026-06-01", "2026-06-30"]));
  });

  test("includes all final statuses except Returned", async () => {
    const { whereSql, values } = buildSettledCasesReportWhereSql(
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

