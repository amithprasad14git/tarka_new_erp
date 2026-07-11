// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `reportSuspenseAcLedger`.
 * Run with: npm test
 */

import { getReportConfig } from "../../lib/reportConfig";
import { getReportFilterInitialValues } from "../../lib/reports/reportFilterDefaults";
import { buildFilterSummaryText } from "../../lib/reports/buildFilterSummary";
import { getReportRunner } from "../../lib/reports/reportRegistry";
import {
  buildSuspenseAcLedgerWhereSql,
  validateReportFilters
} from "../../lib/reports/report_suspense_ac_ledger";

describe("report_suspense_ac_ledger config", () => {
  test("getReportConfig returns standard table report", () => {
    const cfg = getReportConfig("report_suspense_ac_ledger");
    expect(cfg?.label).toMatch(/Suspense AC Ledger/i);
    expect(cfg?.group).toBe("Accounts Reports");
    expect(cfg?.reportLayout?.title).toBe("SUSPENSE AC LEDGER");
    expect(cfg?.reportLayout?.mode).toBeUndefined();
    expect(cfg?.fields?.find((f) => f.name === "fromMonth")?.type).toBe("month");
    expect(cfg?.fields?.find((f) => f.name === "toMonth")?.required).toBe(true);
    expect(cfg?.fields?.find((f) => f.name === "transactionType")?.ui?.emptyOptionLabel).toBe("All");
    expect(cfg?.fields?.find((f) => f.name === "npaCurrentAc")?.lookup?.module).toBe(
      "current_account_master"
    );
    expect(cfg?.columns?.map((c) => c.key)).toEqual([
      "slNo",
      "voucherNo",
      "date",
      "transactionType",
      "npaCurrentAcLabel",
      "remarks",
      "amount"
    ]);
    expect(cfg?.columns?.find((c) => c.key === "amount")?.sum).toBe(true);
    expect(cfg?.reportStyle?.totalRow?.labelColumn).toBe("voucherNo");
  });

  test("month filters default to current month", () => {
    const cfg = getReportConfig("report_suspense_ac_ledger");
    const values = getReportFilterInitialValues(cfg);
    expect(values.fromMonth).toMatch(/^\d{4}-\d{2}$/);
    expect(values.toMonth).toMatch(/^\d{4}-\d{2}$/);
    expect(values.outputFormat).toBe("HTML");
  });

  test("runner is registered", () => {
    expect(typeof getReportRunner("report_suspense_ac_ledger")?.runReport).toBe("function");
    expect(typeof getReportRunner("report_suspense_ac_ledger")?.validateReportFilters).toBe(
      "function"
    );
  });
});

describe("buildSuspenseAcLedgerWhereSql", () => {
  test("always applies month date bounds", () => {
    const { whereSql, values } = buildSuspenseAcLedgerWhereSql({
      fromMonth: "2026-01",
      toMonth: "2026-03"
    });
    expect(whereSql).toContain("DATE(ase.date) >= ?");
    expect(whereSql).toContain("DATE(ase.date) <= ?");
    expect(values).toEqual(["2026-01-01", "2026-03-31"]);
  });

  test("empty transaction type does not add predicate", () => {
    const { whereSql, values } = buildSuspenseAcLedgerWhereSql({
      fromMonth: "2026-04",
      toMonth: "2026-04",
      transactionType: ""
    });
    expect(whereSql).not.toContain("ase.transactionType = ?");
    expect(values).toEqual(["2026-04-01", "2026-04-30"]);
  });

  test("applies optional transaction type and npa current ac filters", () => {
    const { whereSql, values } = buildSuspenseAcLedgerWhereSql({
      fromMonth: "2026-04",
      toMonth: "2026-04",
      transactionType: "Debit",
      npaCurrentAc: "5"
    });
    expect(whereSql).toContain("ase.transactionType = ?");
    expect(whereSql).toContain("ase.npaCurrentAc = ?");
    expect(values).toEqual(["2026-04-01", "2026-04-30", "Debit", 5]);
  });
});

describe("validateReportFilters", () => {
  test("rejects inverted month range", () => {
    const cfg = getReportConfig("report_suspense_ac_ledger");
    expect(
      validateReportFilters(cfg, { fromMonth: "2026-05", toMonth: "2026-04" })
    ).toMatch(/cannot be after/i);
    expect(validateReportFilters(cfg, { fromMonth: "2026-04", toMonth: "2026-05" })).toBeNull();
  });
});

describe("buildFilterSummaryText month labels", () => {
  test("formats from and to month filters", () => {
    const cfg = getReportConfig("report_suspense_ac_ledger");
    const summary = buildFilterSummaryText(cfg, {
      fromMonth: "2026-01",
      toMonth: "2026-03",
      transactionType: "Credit"
    });
    expect(summary).toContain("From Month: 01/2026");
    expect(summary).toContain("To Month: 03/2026");
    expect(summary).toContain("Transaction Type: Credit");
  });
});

