// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `reportSearchLoanAc`.
 * Run with: npm test
 */

import { getYmdISTFromInstant } from "../../lib/istDateTime";
import { getReportConfig } from "../../lib/reportConfig";
import { getReportFilterInitialValues } from "../../lib/reports/reportFilterDefaults";
import {
  buildDataTypeStatusWhereSql,
  buildTextSearchWhereParts,
  normalizeSearchLoanAcDataType
} from "../../lib/reports/report_search_loan_ac";
import { buildOpenCaseStatusWhereSql } from "../../lib/reports/report_pending_cases_on_hand";
import { buildReturnedCaseStatusWhereSql } from "../../lib/reports/report_returned_cases";
import { buildSettledCaseStatusWhereSql } from "../../lib/reports/report_settled_cases";
import { getReportRunner } from "../../lib/reports/reportRegistry";

const PENDING_COLUMN_KEYS = [
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
];

describe("report_search_loan_ac config", () => {
  test("getReportConfig returns search loan AC report with same columns as pending", () => {
    const cfg = getReportConfig("report_search_loan_ac");
    expect(cfg?.label).toMatch(/Search Loan AC/i);
    expect(cfg?.columns?.map((c) => c.key)).toEqual(PENDING_COLUMN_KEYS);
  });

  test("asOnDate defaults to today and dataType defaults to All", () => {
    const cfg = getReportConfig("report_search_loan_ac");
    const values = getReportFilterInitialValues(cfg);
    expect(values.asOnDate).toBe(getYmdISTFromInstant(new Date()));
    expect(values.dataType).toBe("All");
    expect(values.outputFormat).toBe("HTML");
  });

  test("has search text fields and data type select", () => {
    const cfg = getReportConfig("report_search_loan_ac");
    const names = (cfg?.fields || []).map((f) => f.name);
    expect(names).toContain("searchLoanAc");
    expect(names).toContain("searchName");
    expect(names).toContain("searchCaseNo");
    expect(names).toContain("dataType");
  });

  test("closureBalance and amountRecovered are summed in footer", () => {
    const cfg = getReportConfig("report_search_loan_ac");
    const sumKeys = (cfg?.columns || []).filter((c) => c.sum).map((c) => c.key);
    expect(sumKeys).toEqual(["closureBalance", "amountRecovered"]);
  });

  test("runner is registered", () => {
    expect(typeof getReportRunner("report_search_loan_ac")?.runReport).toBe("function");
  });
});

describe("normalizeSearchLoanAcDataType", () => {
  test("defaults missing, empty, and All to All", () => {
    expect(normalizeSearchLoanAcDataType(undefined)).toBe("All");
    expect(normalizeSearchLoanAcDataType("")).toBe("All");
    expect(normalizeSearchLoanAcDataType("All")).toBe("All");
    expect(normalizeSearchLoanAcDataType("all")).toBe("All");
  });
});

describe("buildDataTypeStatusWhereSql", () => {
  test("All applies no case-status filter", () => {
    expect(buildDataTypeStatusWhereSql("All")).toBeNull();
    expect(buildDataTypeStatusWhereSql("")).toBeNull();
    expect(buildDataTypeStatusWhereSql(undefined)).toBeNull();
  });

  test("Ongoing delegates to open-case SQL", () => {
    const ongoing = buildDataTypeStatusWhereSql("Ongoing");
    const open = buildOpenCaseStatusWhereSql();
    expect(ongoing.sql).toBe(open.sql);
    expect(ongoing.values).toEqual(open.values);
  });

  test("Settled delegates to settled-case SQL", () => {
    const settled = buildDataTypeStatusWhereSql("Settled");
    const expected = buildSettledCaseStatusWhereSql();
    expect(settled.sql).toBe(expected.sql);
    expect(settled.values).toEqual(expected.values);
  });

  test("Returned delegates to returned-case SQL", () => {
    const returned = buildDataTypeStatusWhereSql("Returned");
    const expected = buildReturnedCaseStatusWhereSql();
    expect(returned.sql).toBe(expected.sql);
    expect(returned.values).toEqual(expected.values);
  });
});

describe("buildTextSearchWhereParts", () => {
  test("returns no parts when all search fields empty", () => {
    const { parts, values } = buildTextSearchWhereParts({});
    expect(parts).toEqual([]);
    expect(values).toEqual([]);
  });

  test("adds LIKE clauses only for non-empty fields", () => {
    const { parts, values } = buildTextSearchWhereParts({
      searchLoanAc: "  LN123  ",
      searchName: "",
      searchCaseNo: "CASE-01"
    });
    expect(parts).toEqual([
      "nci.loanAccountNo LIKE ? ESCAPE '\\\\'",
      "nci.caseNo LIKE ? ESCAPE '\\\\'"
    ]);
    expect(values).toEqual(["%LN123%", "%CASE-01%"]);
  });

  test("escapes LIKE special characters in search values", () => {
    const { parts, values } = buildTextSearchWhereParts({
      searchName: "100%_done\\x"
    });
    expect(parts).toEqual(["nci.borrower LIKE ? ESCAPE '\\\\'"]);
    expect(values).toEqual(["%100\\%\\_done\\\\x%"]);
  });
});

