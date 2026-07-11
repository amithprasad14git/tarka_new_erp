// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `reportCashDepositWithdrawLedger`.
 * Run with: npm test
 */

import { getReportConfig } from "../../lib/reportConfig";
import { getReportFilterInitialValues } from "../../lib/reports/reportFilterDefaults";
import { buildFilterSummaryText } from "../../lib/reports/buildFilterSummary";
import { getReportRunner } from "../../lib/reports/reportRegistry";
import { buildCashDepositWithdrawLedgerWhereSql } from "../../lib/reports/report_cash_deposit_withdraw_ledger";

describe("report_cash_deposit_withdraw_ledger config", () => {
  test("getReportConfig returns standard table report", () => {
    const cfg = getReportConfig("report_cash_deposit_withdraw_ledger");
    expect(cfg?.label).toMatch(/Cash Deposit & Withdraw Ledger/i);
    expect(cfg?.group).toBe("Accounts Reports");
    expect(cfg?.reportLayout?.title).toBe("CASH DEPOSIT & WITHDRAW LEDGER");
    expect(cfg?.reportLayout?.mode).toBeUndefined();
    expect(cfg?.fields?.find((f) => f.name === "month")?.type).toBe("month");
    expect(cfg?.fields?.find((f) => f.name === "month")?.required).toBe(true);
    expect(cfg?.fields?.find((f) => f.name === "unit")).toBeUndefined();
    expect(cfg?.fields?.find((f) => f.name === "transactionType")?.required).toBe(true);
    expect(cfg?.fields?.find((f) => f.name === "transactionType")?.ui?.emptyOptionLabel).toBeUndefined();
    expect(cfg?.columns?.map((c) => c.key)).toEqual([
      "slNo",
      "voucherNo",
      "date",
      "unitLabel",
      "transactionType",
      "paymentMode",
      "remarks",
      "npaCurrentAcLabel",
      "chequeNo",
      "chequeDate",
      "inFavourOf",
      "amount"
    ]);
    expect(cfg?.columns?.find((c) => c.key === "amount")?.sum).toBe(true);
    expect(cfg?.reportStyle?.totalRow?.labelColumn).toBe("voucherNo");
  });

  test("month filter defaults to current month", () => {
    const cfg = getReportConfig("report_cash_deposit_withdraw_ledger");
    const values = getReportFilterInitialValues(cfg);
    expect(values.month).toMatch(/^\d{4}-\d{2}$/);
    expect(values.outputFormat).toBe("HTML");
  });

  test("runner is registered", () => {
    expect(typeof getReportRunner("report_cash_deposit_withdraw_ledger")?.runReport).toBe("function");
  });
});

describe("buildCashDepositWithdrawLedgerWhereSql", () => {
  test("always applies month date bounds and mandatory transaction type", () => {
    const { whereSql, values } = buildCashDepositWithdrawLedgerWhereSql({
      month: "2026-04",
      transactionType: "Deposit"
    });
    expect(whereSql).toContain("DATE(acdw.date) >= ?");
    expect(whereSql).toContain("DATE(acdw.date) <= ?");
    expect(whereSql).toContain("acdw.transactionType = ?");
    expect(values).toEqual(["2026-04-01", "2026-04-30", "Deposit"]);
  });

  test("missing transaction type returns no rows", () => {
    const { whereSql } = buildCashDepositWithdrawLedgerWhereSql({ month: "2026-04" });
    expect(whereSql).toContain("1=0");
  });

  test("applies optional filters when set in header", () => {
    const { whereSql, values } = buildCashDepositWithdrawLedgerWhereSql({
      month: "2026-01",
      unit: "4",
      transactionType: "Deposit",
      paymentMode: "Cash",
      npaCurrentAc: "7"
    });
    expect(whereSql).toContain("acdw.unit = ?");
    expect(whereSql).toContain("acdw.transactionType = ?");
    expect(whereSql).toContain("acdw.paymentMode = ?");
    expect(whereSql).toContain("acdw.npaCurrentAc = ?");
    expect(values).toEqual(["2026-01-01", "2026-01-31", 4, "Deposit", "Cash", 7]);
  });

  test("does not apply unit filter when unit header is empty", () => {
    const { whereSql, values } = buildCashDepositWithdrawLedgerWhereSql({
      month: "2026-01",
      transactionType: "Withdraw"
    });
    expect(whereSql).not.toContain("acdw.unit = ?");
    expect(whereSql).not.toContain("1=0");
    expect(whereSql).toContain("acdw.transactionType = ?");
    expect(values).toEqual(["2026-01-01", "2026-01-31", "Withdraw"]);
  });
});

describe("buildFilterSummaryText month label", () => {
  test("formats month filter as MM/YYYY", () => {
    const cfg = getReportConfig("report_cash_deposit_withdraw_ledger");
    const summary = buildFilterSummaryText(cfg, {
      month: "2026-04",
      transactionType: "Withdraw"
    });
    expect(summary).toContain("Month: 04/2026");
    expect(summary).toContain("Transaction Type: Withdraw");
  });
});

