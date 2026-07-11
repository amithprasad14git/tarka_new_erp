// Report — Annual Invoice Ledger. All SQL and filter WHERE logic for this report only.

/**
 * FY-scoped invoice summary grouped by NPA Current AC (month + amount rows per section).
 * Config: report_annual_invoice_ledger.
 */

import pool from "../db";
import { toYyyyMmDdForSqlDateField } from "../sqlDateFieldValue";
import { groupStandardLedgerSections } from "./groupStandardLedgerSections";
import { loadFinancialYearById } from "./loadFinancialYearById.js";
import { INVOICE_LEDGER_SOURCES, buildInvoiceSubquery } from "./report_invoice_ledger.js";

/**
 * @param {Record<string, unknown>} filters
 * @param {{ from: string, to: string }} dateRange
 * @returns {{ sql: string, values: unknown[] }}
 */
export function buildAnnualInvoiceSummaryAggregatedSql(filters, dateRange) {
  const subqueries = INVOICE_LEDGER_SOURCES.map(({ table, receivedFk }) =>
    buildInvoiceSubquery(table, receivedFk, filters, { dateRange, summaryOnly: true })
  );
  const unionSql = subqueries.map((s) => s.sql).join(" UNION ALL ");
  const values = subqueries.flatMap((s) => s.values);

  const sql = `
SELECT
  npaCurrentAcLabel,
  monthLabel,
  monthKey,
  SUM(grandTotal) AS amount
FROM (
${unionSql}
) u
GROUP BY npaCurrentAcLabel, monthLabel, monthKey
ORDER BY npaCurrentAcLabel, monthKey
`;

  return { sql, values };
}

/**
 * Runs Annual Invoice Ledger summary for the selected financial year.
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

  const { sql, values } = buildAnnualInvoiceSummaryAggregatedSql(filters, dateRange);
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

