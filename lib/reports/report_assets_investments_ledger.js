// Report — Assets & Investments Ledger. All SQL and filter WHERE logic for this report only.

/**
 * Ledger rows from accounts_assets_investments with optional month/unit/party/payment filters.
 * Config: report_assets_investments_ledger.
 */

import pool from "../db";
import { ACCOUNTS_ASSETS_INVESTMENTS_UNIT_RESTRICT_ROLE } from "../modules/accountsAssetsInvestments";
import { escapeSqlTableId } from "../sqlModuleTable";
import { toYyyyMmDdForSqlDateField } from "../sqlDateFieldValue";
import { monthEndYmd, monthStartYmd, validateMonthRange } from "./monthFilterRange";

const DATE_FORMAT = "%d-%m-%Y";

function sqlTableIds() {
  return {
    aai: escapeSqlTableId("accounts_assets_investments"),
    um: escapeSqlTableId("unit_master"),
    pm: escapeSqlTableId("party_master"),
    cam: escapeSqlTableId("current_account_master")
  };
}

/**
 * @param {object} reportConfig
 * @param {Record<string, unknown>} filters
 * @returns {string | null}
 */
export function validateReportFilters(reportConfig, filters) {
  void reportConfig;
  return validateMonthRange(filters.fromMonth, filters.toMonth);
}

/**
 * @param {Record<string, unknown>} filters
 * @param {object} [user]
 * @returns {{ whereSql: string, values: unknown[] }}
 */
export function buildAssetsInvestmentsLedgerWhereSql(filters, user = null) {
  const parts = [];
  const values = [];

  const from = monthStartYmd(String(filters.fromMonth || "").trim());
  const to = monthEndYmd(String(filters.toMonth || "").trim());
  parts.push("DATE(aai.date) >= ?");
  parts.push("DATE(aai.date) <= ?");
  values.push(from, to);

  const role = user != null ? Number(user.role) : NaN;
  if (Number.isFinite(role) && role === ACCOUNTS_ASSETS_INVESTMENTS_UNIT_RESTRICT_ROLE) {
    const uid = user?.unit != null && user.unit !== "" ? Number(user.unit) : null;
    if (!Number.isFinite(uid)) {
      parts.push("1=0");
    } else {
      parts.push("aai.unit = ?");
      values.push(uid);
    }
  } else if (filters.unit && Number.isFinite(Number(filters.unit))) {
    parts.push("aai.unit = ?");
    values.push(Number(filters.unit));
  }

  if (filters.paidTo && Number.isFinite(Number(filters.paidTo))) {
    parts.push("aai.paidTo = ?");
    values.push(Number(filters.paidTo));
  }

  const paymentMode = String(filters.paymentMode || "").trim();
  if (paymentMode) {
    parts.push("aai.paymentMode = ?");
    values.push(paymentMode);
  }

  if (filters.npaCurrentAc && Number.isFinite(Number(filters.npaCurrentAc))) {
    parts.push("aai.npaCurrentAc = ?");
    values.push(Number(filters.npaCurrentAc));
  }

  return { whereSql: parts.join(" AND "), values };
}

function buildSelectSql() {
  const t = sqlTableIds();
  return `
  SELECT
    aai.voucherNo AS voucherNo,
    DATE_FORMAT(aai.date, '${DATE_FORMAT}') AS date,
    um.unitName AS unitLabel,
    pm.partyName AS paidToLabel,
    aai.remarks AS remarks,
    aai.paymentMode AS paymentMode,
    cam.branch AS npaCurrentAcLabel,
    aai.chequeNo AS chequeNo,
    DATE_FORMAT(aai.chequeDate, '${DATE_FORMAT}') AS chequeDate,
    aai.inFavourOf AS inFavourOf,
    aai.amount AS amount
  FROM ${t.aai} aai
  LEFT JOIN ${t.um} um ON um.id = aai.unit
  LEFT JOIN ${t.pm} pm ON pm.id = aai.paidTo
  LEFT JOIN ${t.cam} cam ON cam.id = aai.npaCurrentAc
`;
}

/**
 * @param {object} user
 * @param {Record<string, unknown>} filters
 * @param {{ limit?: number }} ctx
 */
export async function runReport(user, filters, ctx = {}) {
  const { whereSql, values } = buildAssetsInvestmentsLedgerWhereSql(filters, user);
  const limit = Math.min(Math.max(Number(ctx.limit) || 50000, 1), 50000);
  const sql = `${buildSelectSql()} WHERE ${whereSql} ORDER BY aai.date ASC, aai.id ASC LIMIT ?`;
  const [rawRows] = await pool.query(sql, [...values, limit]);

  const rows = (rawRows || []).map((r, idx) => ({
    slNo: idx + 1,
    voucherNo: r.voucherNo ?? "",
    date: r.date ?? "",
    unitLabel: r.unitLabel ?? "",
    paidToLabel: r.paidToLabel ?? "",
    remarks: r.remarks ?? "",
    paymentMode: r.paymentMode ?? "",
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
