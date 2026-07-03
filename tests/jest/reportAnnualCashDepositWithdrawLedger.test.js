import { getReportConfig } from "../../lib/reportConfig";
import { getReportFilterInitialValues } from "../../lib/reports/reportFilterDefaults";
import { groupStandardLedgerSections } from "../../lib/reports/groupStandardLedgerSections";
import { getReportRunner } from "../../lib/reports/reportRegistry";
import { buildAnnualCashDepositWithdrawSummarySql } from "../../lib/reports/report_annual_cash_deposit_withdraw_ledger";
import { buildCashDepositWithdrawLedgerWhereSql } from "../../lib/reports/report_cash_deposit_withdraw_ledger";

describe("report_annual_cash_deposit_withdraw_ledger config", () => {
  test("getReportConfig returns grouped annual cash ledger report", () => {
    const cfg = getReportConfig("report_annual_cash_deposit_withdraw_ledger");
    expect(cfg?.label).toBe("Annual Cash Deposit & Withdraw Ledger");
    expect(cfg?.group).toBe("Annual Accounts Reports");
    expect(cfg?.reportLayout?.title).toBe("ANNUAL CASH DEPOSIT & WITHDRAW LEDGER");
    expect(cfg?.fields?.find((f) => f.name === "financialYear")?.required).toBe(true);
    expect(cfg?.fields?.find((f) => f.name === "month")).toBeUndefined();
    expect(cfg?.fields?.find((f) => f.name === "transactionType")?.required).toBe(true);
    expect(cfg?.fields?.find((f) => f.name === "transactionType")?.ui?.emptyOptionLabel).toBe("Select");
    expect(cfg?.reportLayout?.tableFitContent).toBe(true);
    expect(cfg?.reportLayout?.contentAlign).toBe("center");
    expect(cfg?.reportStyle?.totalRow?.labelColumn).toBe("monthLabel");
    expect(cfg?.reportStyle?.sectionTotalRow?.labelColumn).toBe("monthLabel");
    expect(cfg?.columns?.map((c) => c.key)).toEqual(["monthLabel", "amount"]);
    expect(cfg?.columns?.find((c) => c.key === "amount")?.sum).toBe(true);
  });

  test("transactionType and outputFormat defaults", () => {
    const cfg = getReportConfig("report_annual_cash_deposit_withdraw_ledger");
    const values = getReportFilterInitialValues(cfg);
    expect(values.transactionType).toBe("");
    expect(values.outputFormat).toBe("HTML");
  });

  test("runner is registered", () => {
    expect(typeof getReportRunner("report_annual_cash_deposit_withdraw_ledger")?.runReport).toBe(
      "function"
    );
  });
});

describe("buildCashDepositWithdrawLedgerWhereSql financial year range", () => {
  test("uses explicit date range when provided", () => {
    const { whereSql, values } = buildCashDepositWithdrawLedgerWhereSql(
      { transactionType: "Deposit" },
      { from: "2025-04-01", to: "2026-03-31" }
    );
    expect(whereSql).toContain("DATE(acdw.date) >= ?");
    expect(whereSql).toContain("DATE(acdw.date) <= ?");
    expect(whereSql).toContain("acdw.transactionType = ?");
    expect(values).toEqual(["2025-04-01", "2026-03-31", "Deposit"]);
  });

  test("invalid transaction type still suppresses rows", () => {
    const { whereSql } = buildCashDepositWithdrawLedgerWhereSql(
      { transactionType: "Select" },
      { from: "2025-04-01", to: "2026-03-31" }
    );
    expect(whereSql).toContain("1=0");
  });
});

describe("buildAnnualCashDepositWithdrawSummarySql", () => {
  test("aggregates by npa current ac and month", () => {
    const { sql, values } = buildAnnualCashDepositWithdrawSummarySql(
      { transactionType: "Withdraw" },
      { from: "2025-04-01", to: "2026-03-31" }
    );
    expect(sql).toContain("GROUP BY npaCurrentAcLabel, monthLabel, monthKey");
    expect(sql).toContain("SUM(amount) AS amount");
    expect(sql).toContain("ORDER BY npaCurrentAcLabel, monthKey");
    expect(values).toEqual(["2025-04-01", "2026-03-31", "Withdraw"]);
  });
});

describe("groupStandardLedgerSections annual cash grouping", () => {
  test("groups month summary rows by npa current ac with amount subtotals", () => {
    const summaryRows = [
      { npaCurrentAcLabel: "SBI Main", monthLabel: "April-2025", amount: 100 },
      { npaCurrentAcLabel: "SBI Main", monthLabel: "May-2025", amount: 50 },
      { npaCurrentAcLabel: "HDFC Branch", monthLabel: "April-2025", amount: 200 }
    ];
    const { sections, grandTotal } = groupStandardLedgerSections(summaryRows, {
      groupKey: "npaCurrentAcLabel",
      sumKey: "amount",
      headerPrefix: "NPA Current AC"
    });
    expect(sections).toHaveLength(2);
    expect(sections[0].headerLabel).toBe("NPA Current AC: SBI Main");
    expect(sections[0].subtotal.amount).toBe(150);
    expect(sections[1].subtotal.amount).toBe(200);
    expect(grandTotal.amount).toBe(350);
  });
});
