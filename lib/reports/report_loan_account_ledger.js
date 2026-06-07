// Report — Loan Account Ledger. All SQL and filter WHERE logic for this report only.

/**
 * Ledger rows from accounts_loan_ac with cumulative as-on-date and optional dimension filters.
 * Config: report_loan_account_ledger.
 */

import pool from "../db";
import { ACCOUNTS_LOAN_AC_UNIT_RESTRICT_ROLE } from "../modules/accountsLoanAc";
import { escapeSqlTableId } from "../sqlModuleTable";
import { toYyyyMmDdForSqlDateField } from "../sqlDateFieldValue";

const DATE_FORMAT = "%d-%m-%Y";

/**
 * @param {unknown} transactionType
 * @param {unknown} amount
 * @returns {{ receiptAmount: number | "", paymentAmount: number | "" }}
 */
export function splitLoanLedgerAmounts(transactionType, amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) {
    return { receiptAmount: "", paymentAmount: "" };
  }
  const type = String(transactionType || "").trim();
  if (type === "Receipt") {
    return { receiptAmount: n, paymentAmount: "" };
  }
  if (type === "Payment") {
    return { receiptAmount: "", paymentAmount: n };
  }
  return { receiptAmount: "", paymentAmount: "" };
}

function sqlTableIds() {
  return {
    ala: escapeSqlTableId("accounts_loan_ac"),
    um: escapeSqlTableId("unit_master"),
    pm: escapeSqlTableId("party_master"),
    cam: escapeSqlTableId("current_account_master")
  };
}

/**
 * @param {Record<string, unknown>} filters
 * @param {object} [user]
 * @returns {{ whereSql: string, values: unknown[] }}
 */
export function buildLoanAccountLedgerWhereSql(filters, user = null) {
  const parts = [];
  const values = [];

  const asOn = toYyyyMmDdForSqlDateField(filters.asOnDate);
  parts.push("DATE(ala.date) <= ?");
  values.push(asOn);

  const role = user != null ? Number(user.role) : NaN;
  if (Number.isFinite(role) && role === ACCOUNTS_LOAN_AC_UNIT_RESTRICT_ROLE) {
    const uid = user?.unit != null && user.unit !== "" ? Number(user.unit) : null;
    if (!Number.isFinite(uid)) {
      parts.push("1=0");
    } else {
      parts.push("ala.unit = ?");
      values.push(uid);
    }
  } else if (filters.unit && Number.isFinite(Number(filters.unit))) {
    parts.push("ala.unit = ?");
    values.push(Number(filters.unit));
  }

  if (filters.npaCurrentAc && Number.isFinite(Number(filters.npaCurrentAc))) {
    parts.push("ala.npaCurrentAc = ?");
    values.push(Number(filters.npaCurrentAc));
  }

  const transactionType = String(filters.transactionType || "").trim();
  if (transactionType === "Receipt" || transactionType === "Payment") {
    parts.push("ala.transactionType = ?");
    values.push(transactionType);
  }

  const paymentMode = String(filters.paymentMode || "").trim();
  if (paymentMode) {
    parts.push("ala.paymentMode = ?");
    values.push(paymentMode);
  }

  if (filters.party && Number.isFinite(Number(filters.party))) {
    parts.push("ala.party = ?");
    values.push(Number(filters.party));
  }

  return { whereSql: parts.join(" AND "), values };
}

function buildSelectSql() {
  const t = sqlTableIds();
  return `
  SELECT
    ala.voucherNo AS voucherNo,
    DATE_FORMAT(ala.date, '${DATE_FORMAT}') AS date,
    um.unitName AS unitLabel,
    ala.transactionType AS transactionType,
    pm.partyName AS partyLabel,
    ala.remarks AS remarks,
    ala.paymentMode AS paymentMode,
    cam.branch AS npaCurrentAcLabel,
    ala.chequeNo AS chequeNo,
    DATE_FORMAT(ala.chequeDate, '${DATE_FORMAT}') AS chequeDate,
    ala.inFavourOf AS inFavourOf,
    ala.amount AS amount
  FROM ${t.ala} ala
  LEFT JOIN ${t.um} um ON um.id = ala.unit
  LEFT JOIN ${t.pm} pm ON pm.id = ala.party
  LEFT JOIN ${t.cam} cam ON cam.id = ala.npaCurrentAc
`;
}

/**
 * @param {object} user
 * @param {Record<string, unknown>} filters
 * @param {{ limit?: number }} ctx
 */
export async function runReport(user, filters, ctx = {}) {
  const { whereSql, values } = buildLoanAccountLedgerWhereSql(filters, user);
  const limit = Math.min(Math.max(Number(ctx.limit) || 50000, 1), 50000);
  const sql = `${buildSelectSql()} WHERE ${whereSql} ORDER BY ala.date ASC, ala.id ASC LIMIT ?`;
  const [rawRows] = await pool.query(sql, [...values, limit]);

  const rows = (rawRows || []).map((r, idx) => {
    const { receiptAmount, paymentAmount } = splitLoanLedgerAmounts(r.transactionType, r.amount);
    return {
      slNo: idx + 1,
      voucherNo: r.voucherNo ?? "",
      date: r.date ?? "",
      unitLabel: r.unitLabel ?? "",
      transactionType: r.transactionType ?? "",
      partyLabel: r.partyLabel ?? "",
      remarks: r.remarks ?? "",
      paymentMode: r.paymentMode ?? "",
      npaCurrentAcLabel: r.npaCurrentAcLabel ?? "",
      chequeNo: r.chequeNo ?? "",
      chequeDate: r.chequeDate ?? "",
      inFavourOf: r.inFavourOf ?? "",
      receiptAmount,
      paymentAmount
    };
  });

  return {
    rows,
    truncated: (rawRows || []).length >= limit
  };
}
