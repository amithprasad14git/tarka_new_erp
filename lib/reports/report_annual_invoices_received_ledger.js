// Report — Annual Invoices Received Ledger. All SQL and filter WHERE logic for this report only.

/**
 * FY-scoped invoices received summary grouped by NPA Current AC (month + amount rows per section).
 * Config: report_annual_invoices_received_ledger.
 */

import pool from "../db";
import { toYyyyMmDdForSqlDateField } from "../sqlDateFieldValue";
import { groupStandardLedgerSections } from "./groupStandardLedgerSections";
import { loadFinancialYearById } from "./loadFinancialYearById.js";
import {
  buildInvoicesReceivedLedgerWhereSql,
  buildInvoicesReceivedSummarySelectSql
} from "./report_invoices_received_ledger.js";

/** Amount columns summed in the annual received summary sections. */
const SUM_KEYS = ["billedAmount", "tdsAmount", "receivedAmount"];

/**
 * @param {Record<string, unknown>} filters
 * @param {{ from: string, to: string }} dateRange
 * @returns {{ sql: string, values: unknown[] }}
 */
export function buildAnnualInvoicesReceivedSummaryAggregatedSql(filters, dateRange) {
  const { whereSql, values } = buildInvoicesReceivedLedgerWhereSql(filters, dateRange);
  const innerSql = `${buildInvoicesReceivedSummarySelectSql()} WHERE ${whereSql}`;

  const sql = `
SELECT
  npaCurrentAcLabel,
  monthLabel,
  monthKey,
  SUM(billedAmount) AS billedAmount,
  SUM(tdsAmount) AS tdsAmount,
  SUM(receivedAmount) AS receivedAmount
FROM (
${innerSql}
) u
GROUP BY npaCurrentAcLabel, monthLabel, monthKey
ORDER BY npaCurrentAcLabel, monthKey
`;

  return { sql, values };
}

/**
 * Runs Annual Invoices Received Ledger for the selected financial year.
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

  const { sql, values } = buildAnnualInvoicesReceivedSummaryAggregatedSql(filters, dateRange);
  const [rawRows] = await pool.query(sql, values);

  const summaryRows = (rawRows || []).map((r) => ({
    npaCurrentAcLabel: r.npaCurrentAcLabel ?? "",
    monthLabel: r.monthLabel ?? "",
    billedAmount: r.billedAmount ?? 0,
    tdsAmount: r.tdsAmount ?? 0,
    receivedAmount: r.receivedAmount ?? 0
  }));

  const { sections, grandTotal } = groupStandardLedgerSections(summaryRows, {
    groupKey: "npaCurrentAcLabel",
    sumKeys: SUM_KEYS,
    headerPrefix: "NPA Current AC"
  });

  return {
    outputMode: "grouped",
    groupedSections: sections,
    grandTotal,
    truncated: false
  };
}

