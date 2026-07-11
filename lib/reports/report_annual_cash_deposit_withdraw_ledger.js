// Report — Annual Cash Deposit & Withdraw Ledger. All SQL and filter WHERE logic for this report only.

/**
 * FY-scoped cash deposit/withdraw summary grouped by NPA Current AC (month + amount rows per section).
 * Config: report_annual_cash_deposit_withdraw_ledger.
 */

import pool from "../db";
import { toYyyyMmDdForSqlDateField } from "../sqlDateFieldValue";
import { groupStandardLedgerSections } from "./groupStandardLedgerSections";
import { loadFinancialYearById } from "./loadFinancialYearById.js";
import {
  buildCashDepositWithdrawLedgerWhereSql,
  buildCashDepositWithdrawSummarySelectSql
} from "./report_cash_deposit_withdraw_ledger.js";

/**
 * @param {Record<string, unknown>} filters
 * @param {{ from: string, to: string }} dateRange
 * @returns {{ sql: string, values: unknown[] }}
 */
export function buildAnnualCashDepositWithdrawSummarySql(filters, dateRange) {
  const { whereSql, values } = buildCashDepositWithdrawLedgerWhereSql(filters, dateRange);
  const innerSql = `${buildCashDepositWithdrawSummarySelectSql()} WHERE ${whereSql}`;

  const sql = `
SELECT
  npaCurrentAcLabel,
  monthLabel,
  monthKey,
  SUM(amount) AS amount
FROM (
${innerSql}
) u
GROUP BY npaCurrentAcLabel, monthLabel, monthKey
ORDER BY npaCurrentAcLabel, monthKey
`;

  return { sql, values };
}

/**
 * Runs Annual Cash Deposit & Withdraw Ledger for the selected financial year.
 * @param {object} user
 * @param {Record<string, unknown>} filters
 * @param {{ limit?: number }} ctx
 */
export async function runReport(user, filters, ctx = {}) {
  void user;
  void ctx;

  const financialYear = await loadFinancialYearById(filters.financialYear);
  if (!financialYear) {
    throw new Error("Invalid Financial Year");
  }

  const dateRange = {
    from: toYyyyMmDdForSqlDateField(financialYear.startDate),
    to: toYyyyMmDdForSqlDateField(financialYear.endDate)
  };

  const { sql, values } = buildAnnualCashDepositWithdrawSummarySql(filters, dateRange);
  const [rawRows] = await pool.query(sql, values);

  const summaryRows = (rawRows || []).map((r) => ({
    npaCurrentAcLabel: r.npaCurrentAcLabel ?? "",
    monthLabel: r.monthLabel ?? "",
    amount: r.amount ?? 0
  }));

  const { sections, grandTotal } = groupStandardLedgerSections(summaryRows, {
    groupKey: "npaCurrentAcLabel",
    sumKey: "amount",
    headerPrefix: "NPA Current AC"
  });

  return {
    outputMode: "grouped",
    groupedSections: sections,
    grandTotal,
    truncated: false
  };
}

