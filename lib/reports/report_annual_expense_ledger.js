// Report — Annual Expense Ledger. All SQL and filter WHERE logic for this report only.

/**
 * FY-scoped expense summary grouped by NPA Current AC with summary or month/category rows.
 * Config: report_annual_expense_ledger.
 */

import pool from "../db";
import { toYyyyMmDdForSqlDateField } from "../sqlDateFieldValue";
import { groupStandardLedgerSections } from "./groupStandardLedgerSections";
import { loadFinancialYearById } from "./loadFinancialYearById.js";
import {
  buildExpenseLedgerSummarySelectSql,
  buildExpenseLedgerWhereSql
} from "./report_expense_ledger.js";

/** Month × payment-mode totals per NPA Current AC (default data type). */
export const ANNUAL_EXPENSE_LEDGER_DATA_TYPE_SUMMARY = "Summary";
/** Nested NPA → month → expense-category sections with payment-mode columns. */
export const ANNUAL_EXPENSE_LEDGER_DATA_TYPE_EXPENSE_CATEGORY = "Expense Category Wise";

/** Payment-mode amount columns summed in category-wise sections. */
const SUM_KEYS = ["byCard", "byCheque", "byCash", "byUpi"];

/** Zeroed payment-mode totals object. */
function emptyTotals() {
  return { byCard: 0, byCheque: 0, byCash: 0, byUpi: 0 };
}

/** Accumulates payment-mode amounts from a row into a totals object. */
function addTotals(target, row) {
  for (const key of SUM_KEYS) target[key] += Number(row[key] || 0);
}

/**
 * @param {Record<string, unknown>} filters
 * @param {{ from: string, to: string }} dateRange
 * @returns {{ sql: string, values: unknown[] }}
 */
export function buildAnnualExpenseSummarySql(filters, dateRange) {
  const { whereSql, values } = buildExpenseLedgerWhereSql(filters, dateRange);
  const innerSql = `${buildExpenseLedgerSummarySelectSql()} WHERE ${whereSql}`;

  const sql = `
SELECT
  npaCurrentAcLabel,
  monthLabel,
  monthKey,
  SUM(byCard) AS byCard,
  SUM(byCheque) AS byCheque,
  SUM(byCash) AS byCash,
  SUM(byUpi) AS byUpi
FROM (
${innerSql}
) u
GROUP BY npaCurrentAcLabel, monthLabel, monthKey
ORDER BY npaCurrentAcLabel, monthKey
`;

  return { sql, values };
}

/**
 * @param {Record<string, unknown>} filters
 * @param {{ from: string, to: string }} dateRange
 * @returns {{ sql: string, values: unknown[] }}
 */
export function buildAnnualExpenseCategoryWiseSql(filters, dateRange) {
  const { whereSql, values } = buildExpenseLedgerWhereSql(filters, dateRange);
  const innerSql = `${buildExpenseLedgerSummarySelectSql()} WHERE ${whereSql}`;

  const sql = `
SELECT
  npaCurrentAcLabel,
  monthLabel,
  monthKey,
  expenseCategoryLabel,
  SUM(byCard) AS byCard,
  SUM(byCheque) AS byCheque,
  SUM(byCash) AS byCash,
  SUM(byUpi) AS byUpi
FROM (
${innerSql}
) u
GROUP BY npaCurrentAcLabel, monthLabel, monthKey, expenseCategoryLabel
ORDER BY npaCurrentAcLabel, monthKey, expenseCategoryLabel
`;

  return { sql, values };
}

/**
 * Groups category-wise SQL rows into NPA → month → category sections with subtotals.
 * @param {Array<Record<string, unknown>>} rawRows
 * @returns {{ sections: object[], grandTotal: object }}
 */
export function buildCategoryWiseSections(rawRows) {
  const sectionMap = new Map();
  const sections = [];
  const grandTotal = emptyTotals();

  for (const raw of rawRows || []) {
    const npaCurrentAcLabel = String(raw.npaCurrentAcLabel ?? "").trim() || "(Blank)";
    const monthLabel = String(raw.monthLabel ?? "").trim() || "(Blank)";

    let section = sectionMap.get(npaCurrentAcLabel);
    if (!section) {
      section = {
        label: npaCurrentAcLabel,
        headerLabel: `NPA Current AC: ${npaCurrentAcLabel}`,
        monthGroups: [],
        subtotal: emptyTotals()
      };
      sectionMap.set(npaCurrentAcLabel, section);
      sections.push(section);
    }

    let monthGroup = section.monthGroups.find((g) => g.label === monthLabel);
    if (!monthGroup) {
      monthGroup = {
        label: monthLabel,
        headerLabel: `Month: ${monthLabel}`,
        rows: [],
        subtotal: emptyTotals()
      };
      section.monthGroups.push(monthGroup);
    }

    const row = {
      expenseCategoryLabel: raw.expenseCategoryLabel ?? "(Blank)",
      byCard: raw.byCard ?? 0,
      byCheque: raw.byCheque ?? 0,
      byCash: raw.byCash ?? 0,
      byUpi: raw.byUpi ?? 0
    };
    monthGroup.rows.push(row);
    addTotals(monthGroup.subtotal, row);
    addTotals(section.subtotal, row);
    addTotals(grandTotal, row);
  }

  for (const section of sections) {
    for (const monthGroup of section.monthGroups || []) {
      monthGroup.rows = monthGroup.rows.map((row, idx) => ({ ...row, slNo: idx + 1 }));
    }
  }

  return { sections, grandTotal };
}

/**
 * Runs Annual Expense Ledger for the selected financial year (Summary or Category Wise).
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
  const dataType = String(filters.dataType || ANNUAL_EXPENSE_LEDGER_DATA_TYPE_SUMMARY).trim();

  if (dataType === ANNUAL_EXPENSE_LEDGER_DATA_TYPE_EXPENSE_CATEGORY) {
    const { sql, values } = buildAnnualExpenseCategoryWiseSql(filters, dateRange);
    const [rawRows] = await pool.query(sql, values);
    const { sections, grandTotal } = buildCategoryWiseSections(rawRows);
    return { outputMode: "grouped", groupedSections: sections, grandTotal, truncated: false };
  }

  const { sql, values } = buildAnnualExpenseSummarySql(filters, dateRange);
  const [rawRows] = await pool.query(sql, values);
  const summaryRows = (rawRows || []).map((r) => ({
    npaCurrentAcLabel: r.npaCurrentAcLabel ?? "",
    monthLabel: r.monthLabel ?? "",
    byCard: r.byCard ?? 0,
    byCheque: r.byCheque ?? 0,
    byCash: r.byCash ?? 0,
    byUpi: r.byUpi ?? 0
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

