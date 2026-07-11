// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `reportCurrentAcTransferLedger`.
 * Run with: npm test
 */

import { getReportConfig } from "../../lib/reportConfig";
import { getReportFilterInitialValues } from "../../lib/reports/reportFilterDefaults";
import { buildFilterSummaryText } from "../../lib/reports/buildFilterSummary";
import { getReportRunner } from "../../lib/reports/reportRegistry";
import {
  buildCurrentAcTransferLedgerWhereSql,
  validateReportFilters
} from "../../lib/reports/report_current_ac_transfer_ledger";

describe("report_current_ac_transfer_ledger config", () => {
  test("getReportConfig returns standard table report", () => {
    const cfg = getReportConfig("report_current_ac_transfer_ledger");
    expect(cfg?.label).toMatch(/Current AC Transfer Ledger/i);
    expect(cfg?.group).toBe("Accounts Reports");
    expect(cfg?.reportLayout?.title).toBe("CURRENT AC TRANSFER LEDGER");
    expect(cfg?.reportLayout?.mode).toBeUndefined();
    expect(cfg?.fields?.find((f) => f.name === "fromMonth")?.type).toBe("month");
    expect(cfg?.fields?.find((f) => f.name === "toMonth")?.required).toBe(true);
    expect(cfg?.fields?.find((f) => f.name === "fromCurrentAc")?.lookup?.module).toBe(
      "current_account_master"
    );
    expect(cfg?.fields?.find((f) => f.name === "toCurrentAc")?.lookup?.module).toBe(
      "current_account_master"
    );
    expect(cfg?.columns?.map((c) => c.key)).toEqual([
      "slNo",
      "voucherNo",
      "date",
      "fromCurrentAcLabel",
      "toCurrentAcLabel",
      "remarks",
      "amount"
    ]);
    expect(cfg?.columns?.find((c) => c.key === "amount")?.sum).toBe(true);
    expect(cfg?.reportStyle?.totalRow?.labelColumn).toBe("voucherNo");
  });

  test("month filters default to current month", () => {
    const cfg = getReportConfig("report_current_ac_transfer_ledger");
    const values = getReportFilterInitialValues(cfg);
    expect(values.fromMonth).toMatch(/^\d{4}-\d{2}$/);
    expect(values.toMonth).toMatch(/^\d{4}-\d{2}$/);
    expect(values.outputFormat).toBe("HTML");
  });

  test("runner is registered", () => {
    expect(typeof getReportRunner("report_current_ac_transfer_ledger")?.runReport).toBe("function");
    expect(typeof getReportRunner("report_current_ac_transfer_ledger")?.validateReportFilters).toBe(
      "function"
    );
  });
});

describe("buildCurrentAcTransferLedgerWhereSql", () => {
  test("always applies month date bounds", () => {
    const { whereSql, values } = buildCurrentAcTransferLedgerWhereSql({
      fromMonth: "2026-01",
      toMonth: "2026-03"
    });
    expect(whereSql).toContain("DATE(acat.date) >= ?");
    expect(whereSql).toContain("DATE(acat.date) <= ?");
    expect(values).toEqual(["2026-01-01", "2026-03-31"]);
  });

  test("applies optional from and to current ac filters", () => {
    const { whereSql, values } = buildCurrentAcTransferLedgerWhereSql({
      fromMonth: "2026-04",
      toMonth: "2026-04",
      fromCurrentAc: "3",
      toCurrentAc: "7"
    });
    expect(whereSql).toContain("acat.fromCurrentAc = ?");
    expect(whereSql).toContain("acat.toCurrentAc = ?");
    expect(values).toEqual(["2026-04-01", "2026-04-30", 3, 7]);
  });
});

describe("validateReportFilters", () => {
  test("rejects inverted month range", () => {
    const cfg = getReportConfig("report_current_ac_transfer_ledger");
    expect(
      validateReportFilters(cfg, { fromMonth: "2026-05", toMonth: "2026-04" })
    ).toMatch(/cannot be after/i);
    expect(validateReportFilters(cfg, { fromMonth: "2026-04", toMonth: "2026-05" })).toBeNull();
  });
});

describe("buildFilterSummaryText month labels", () => {
  test("formats from and to month filters", () => {
    const cfg = getReportConfig("report_current_ac_transfer_ledger");
    const summary = buildFilterSummaryText(cfg, {
      fromMonth: "2026-01",
      toMonth: "2026-03"
    });
    expect(summary).toContain("From Month: 01/2026");
    expect(summary).toContain("To Month: 03/2026");
  });
});

