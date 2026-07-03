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

export const ANNUAL_EXPENSE_LEDGER_DATA_TYPE_SUMMARY = "Summary";
export const ANNUAL_EXPENSE_LEDGER_DATA_TYPE_EXPENSE_CATEGORY = "Expense Category Wise";

const SUM_KEYS = ["byCard", "byCheque", "byCash", "byUpi"];

function emptyTotals() {
  return { byCard: 0, byCheque: 0, byCash: 0, byUpi: 0 };
}

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
