// Report — Cash Deposit & Withdraw Ledger. All SQL and filter WHERE logic for this report only.

/**
 * Ledger rows from accounts_cash_deposit_withdraw with month + mandatory transaction type and optional payment/NPA filters.
 * Config: report_cash_deposit_withdraw_ledger.
 */

import pool from "../db";
import { ACCOUNTS_CASH_DEPOSIT_WITHDRAW_UNIT_RESTRICT_ROLE } from "../modules/accountsCashDepositWithdraw";
import { escapeSqlTableId } from "../sqlModuleTable";
import { monthEndYmd, monthStartYmd } from "./monthFilterRange";

const DATE_FORMAT = "%d-%m-%Y";

function sqlTableIds() {
  return {
    acdw: escapeSqlTableId("accounts_cash_deposit_withdraw"),
    um: escapeSqlTableId("unit_master"),
    cam: escapeSqlTableId("current_account_master")
  };
}

/**
 * @param {Record<string, unknown>} filters
 * @param {object} [user]
 * @returns {{ whereSql: string, values: unknown[] }}
 */
export function buildCashDepositWithdrawLedgerWhereSql(filters, user = null) {
  const parts = [];
  const values = [];

  const month = String(filters.month || "").trim();
  const from = monthStartYmd(month);
  const to = monthEndYmd(month);
  parts.push("DATE(acdw.date) >= ?");
  parts.push("DATE(acdw.date) <= ?");
  values.push(from, to);

  const role = user != null ? Number(user.role) : NaN;
  if (Number.isFinite(role) && role === ACCOUNTS_CASH_DEPOSIT_WITHDRAW_UNIT_RESTRICT_ROLE) {
    const uid = user?.unit != null && user.unit !== "" ? Number(user.unit) : null;
    if (!Number.isFinite(uid)) {
      parts.push("1=0");
    } else {
      parts.push("acdw.unit = ?");
      values.push(uid);
    }
  }

  const transactionType = String(filters.transactionType || "").trim();
  if (transactionType === "Deposit" || transactionType === "Withdraw") {
    parts.push("acdw.transactionType = ?");
    values.push(transactionType);
  } else {
    parts.push("1=0");
  }

  const paymentMode = String(filters.paymentMode || "").trim();
  if (paymentMode) {
    parts.push("acdw.paymentMode = ?");
    values.push(paymentMode);
  }

  if (filters.npaCurrentAc && Number.isFinite(Number(filters.npaCurrentAc))) {
    parts.push("acdw.npaCurrentAc = ?");
    values.push(Number(filters.npaCurrentAc));
  }

  return { whereSql: parts.join(" AND "), values };
}

function buildSelectSql() {
  const t = sqlTableIds();
  return `
  SELECT
    acdw.voucherNo AS voucherNo,
    DATE_FORMAT(acdw.date, '${DATE_FORMAT}') AS date,
    um.unitName AS unitLabel,
    acdw.transactionType AS transactionType,
    acdw.paymentMode AS paymentMode,
    acdw.remarks AS remarks,
    cam.branch AS npaCurrentAcLabel,
    acdw.chequeNo AS chequeNo,
    DATE_FORMAT(acdw.chequeDate, '${DATE_FORMAT}') AS chequeDate,
    acdw.inFavourOf AS inFavourOf,
    acdw.amount AS amount
  FROM ${t.acdw} acdw
  LEFT JOIN ${t.um} um ON um.id = acdw.unit
  LEFT JOIN ${t.cam} cam ON cam.id = acdw.npaCurrentAc
`;
}

/**
 * @param {object} user
 * @param {Record<string, unknown>} filters
 * @param {{ limit?: number }} ctx
 */
export async function runReport(user, filters, ctx = {}) {
  const { whereSql, values } = buildCashDepositWithdrawLedgerWhereSql(filters, user);
  const limit = Math.min(Math.max(Number(ctx.limit) || 50000, 1), 50000);
  const sql = `${buildSelectSql()} WHERE ${whereSql} ORDER BY acdw.date ASC, acdw.id ASC LIMIT ?`;
  const [rawRows] = await pool.query(sql, [...values, limit]);

  const rows = (rawRows || []).map((r, idx) => ({
    slNo: idx + 1,
    voucherNo: r.voucherNo ?? "",
    date: r.date ?? "",
    unitLabel: r.unitLabel ?? "",
    transactionType: r.transactionType ?? "",
    paymentMode: r.paymentMode ?? "",
    remarks: r.remarks ?? "",
    npaCurrentAcLabel: r.npaCurrentAcLabel ?? "",
    chequeNo: r.chequeNo ?? "",
    chequeDate: r.chequeDate ?? "",
    inFavourOf: r.inFavourOf ?? "",
    amount: r.amount ?? ""
  }));

  return {
    rows,
    truncated: (rawRows || []).length >= limit
  };
}
