// Report — Expense Ledger. All SQL and filter WHERE logic for this report only.

/**
 * Ledger rows from accounts_expense_voucher; General flat or grouped by payment mode / expense category.
 * Config: report_expense_ledger.
 */

import pool from "../db";
import { escapeSqlTableId } from "../sqlModuleTable";
import { monthEndYmd, monthStartYmd } from "./monthFilterRange";
import { groupStandardLedgerSections } from "./groupStandardLedgerSections";

const DATE_FORMAT = "%d-%m-%Y";

export const EXPENSE_LEDGER_DATA_TYPE_GENERAL = "General";
export const EXPENSE_LEDGER_DATA_TYPE_PAYMENT_MODE = "Payment Mode Wise";
export const EXPENSE_LEDGER_DATA_TYPE_EXPENSE_CATEGORY = "Expense Category Wise";

function sqlTableIds() {
  return {
    aev: escapeSqlTableId("accounts_expense_voucher"),
    um: escapeSqlTableId("unit_master"),
    pm: escapeSqlTableId("party_master"),
    lvm: escapeSqlTableId("lookup_value_master"),
    cam: escapeSqlTableId("current_account_master")
  };
}

/**
 * @param {Record<string, unknown>} filters
 * @returns {{ whereSql: string, values: unknown[] }}
 */
export function buildExpenseLedgerWhereSql(filters) {
  const parts = [];
  const values = [];

  const month = String(filters.month || "").trim();
  const from = monthStartYmd(month);
  const to = monthEndYmd(month);
  parts.push("DATE(aev.date) >= ?");
  parts.push("DATE(aev.date) <= ?");
  values.push(from, to);

  if (filters.unit && Number.isFinite(Number(filters.unit))) {
    parts.push("aev.unit = ?");
    values.push(Number(filters.unit));
  }

  if (filters.npaCurrentAc && Number.isFinite(Number(filters.npaCurrentAc))) {
    parts.push("aev.npaCurrentAc = ?");
    values.push(Number(filters.npaCurrentAc));
  }

  const paymentMode = String(filters.paymentMode || "").trim();
  if (paymentMode) {
    parts.push("aev.paymentMode = ?");
    values.push(paymentMode);
  }

  if (filters.paidTo && Number.isFinite(Number(filters.paidTo))) {
    parts.push("aev.paidTo = ?");
    values.push(Number(filters.paidTo));
  }

  if (filters.expenseCategory && Number.isFinite(Number(filters.expenseCategory))) {
    parts.push("aev.expenseCategory = ?");
    values.push(Number(filters.expenseCategory));
  }

  return { whereSql: parts.join(" AND "), values };
}

function buildOrderBy(dataType) {
  if (dataType === EXPENSE_LEDGER_DATA_TYPE_PAYMENT_MODE) {
    return "aev.paymentMode ASC, aev.date ASC, aev.id ASC";
  }
  if (dataType === EXPENSE_LEDGER_DATA_TYPE_EXPENSE_CATEGORY) {
    return "lvm.lookupValue ASC, aev.date ASC, aev.id ASC";
  }
  return "aev.date ASC, aev.id ASC";
}

function buildSelectSql() {
  const t = sqlTableIds();
  return `
  SELECT
    aev.voucherNo AS voucherNo,
    DATE_FORMAT(aev.date, '${DATE_FORMAT}') AS date,
    um.unitName AS unitLabel,
    pm.partyName AS paidToLabel,
    lvm.lookupValue AS expenseCategoryLabel,
    aev.remarks AS remarks,
    aev.paymentMode AS paymentMode,
    cam.branch AS npaCurrentAcLabel,
    aev.chequeNo AS chequeNo,
    DATE_FORMAT(aev.chequeDate, '${DATE_FORMAT}') AS chequeDate,
    aev.inFavourOf AS inFavourOf,
    aev.amount AS amount
  FROM ${t.aev} aev
  LEFT JOIN ${t.um} um ON um.id = aev.unit
  LEFT JOIN ${t.pm} pm ON pm.id = aev.paidTo
  LEFT JOIN ${t.lvm} lvm ON lvm.id = aev.expenseCategory
  LEFT JOIN ${t.cam} cam ON cam.id = aev.npaCurrentAc
`;
}

function mapDetailRow(r, slNo) {
  return {
    slNo,
    voucherNo: r.voucherNo ?? "",
    date: r.date ?? "",
    unitLabel: r.unitLabel ?? "",
    paidToLabel: r.paidToLabel ?? "",
    expenseCategoryLabel: r.expenseCategoryLabel ?? "",
    remarks: r.remarks ?? "",
    paymentMode: r.paymentMode ?? "",
    npaCurrentAcLabel: r.npaCurrentAcLabel ?? "",
    chequeNo: r.chequeNo ?? "",
    chequeDate: r.chequeDate ?? "",
    inFavourOf: r.inFavourOf ?? "",
    amount: r.amount ?? ""
  };
}

/**
 * @param {object} user
 * @param {Record<string, unknown>} filters
 * @param {{ limit?: number }} ctx
 */
export async function runReport(user, filters, ctx = {}) {
  const dataType = String(filters.dataType || EXPENSE_LEDGER_DATA_TYPE_GENERAL).trim();
  const { whereSql, values } = buildExpenseLedgerWhereSql(filters);
  const limit = Math.min(Math.max(Number(ctx.limit) || 50000, 1), 50000);
  const orderBy = buildOrderBy(dataType);
  const sql = `${buildSelectSql()} WHERE ${whereSql} ORDER BY ${orderBy} LIMIT ?`;
  const [rawRows] = await pool.query(sql, [...values, limit]);

  const detailRows = (rawRows || []).map((r, idx) => mapDetailRow(r, idx + 1));
  const truncated = (rawRows || []).length >= limit;

  if (dataType === EXPENSE_LEDGER_DATA_TYPE_PAYMENT_MODE) {
    const { sections, grandTotal } = groupStandardLedgerSections(detailRows, {
      groupKey: "paymentMode",
      headerPrefix: "Payment Mode"
    });
    return { outputMode: "grouped", groupedSections: sections, grandTotal, truncated };
  }

  if (dataType === EXPENSE_LEDGER_DATA_TYPE_EXPENSE_CATEGORY) {
    const { sections, grandTotal } = groupStandardLedgerSections(detailRows, {
      groupKey: "expenseCategoryLabel",
      headerPrefix: "Expense Category"
    });
    return { outputMode: "grouped", groupedSections: sections, grandTotal, truncated };
  }

  return { outputMode: "flat", rows: detailRows, truncated };
}
