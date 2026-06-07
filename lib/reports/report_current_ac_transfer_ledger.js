// Report — Current AC Transfer Ledger. All SQL and filter WHERE logic for this report only.

/**
 * Ledger rows from accounts_current_ac_transfer with month range and optional from/to account filters.
 * Config: report_current_ac_transfer_ledger.
 */

import pool from "../db";
import { escapeSqlTableId } from "../sqlModuleTable";
import { monthEndYmd, monthStartYmd, validateMonthRange } from "./monthFilterRange";

const DATE_FORMAT = "%d-%m-%Y";

function sqlTableIds() {
  return {
    acat: escapeSqlTableId("accounts_current_ac_transfer"),
    camFrom: escapeSqlTableId("current_account_master"),
    camTo: escapeSqlTableId("current_account_master")
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
 * @returns {{ whereSql: string, values: unknown[] }}
 */
export function buildCurrentAcTransferLedgerWhereSql(filters) {
  const parts = [];
  const values = [];

  const from = monthStartYmd(String(filters.fromMonth || "").trim());
  const to = monthEndYmd(String(filters.toMonth || "").trim());
  parts.push("DATE(acat.date) >= ?");
  parts.push("DATE(acat.date) <= ?");
  values.push(from, to);

  if (filters.fromCurrentAc && Number.isFinite(Number(filters.fromCurrentAc))) {
    parts.push("acat.fromCurrentAc = ?");
    values.push(Number(filters.fromCurrentAc));
  }

  if (filters.toCurrentAc && Number.isFinite(Number(filters.toCurrentAc))) {
    parts.push("acat.toCurrentAc = ?");
    values.push(Number(filters.toCurrentAc));
  }

  return { whereSql: parts.join(" AND "), values };
}

function buildSelectSql() {
  const t = sqlTableIds();
  return `
  SELECT
    acat.voucherNo AS voucherNo,
    DATE_FORMAT(acat.date, '${DATE_FORMAT}') AS date,
    camFrom.branch AS fromCurrentAcLabel,
    camTo.branch AS toCurrentAcLabel,
    acat.remarks AS remarks,
    acat.amount AS amount
  FROM ${t.acat} acat
  LEFT JOIN ${t.camFrom} camFrom ON camFrom.id = acat.fromCurrentAc
  LEFT JOIN ${t.camTo} camTo ON camTo.id = acat.toCurrentAc
`;
}

/**
 * @param {object} user
 * @param {Record<string, unknown>} filters
 * @param {{ limit?: number }} ctx
 */
export async function runReport(user, filters, ctx = {}) {
  void user;
  const { whereSql, values } = buildCurrentAcTransferLedgerWhereSql(filters);
  const limit = Math.min(Math.max(Number(ctx.limit) || 50000, 1), 50000);
  const sql = `${buildSelectSql()} WHERE ${whereSql} ORDER BY acat.date ASC, acat.id ASC LIMIT ?`;
  const [rawRows] = await pool.query(sql, [...values, limit]);

  const rows = (rawRows || []).map((r, idx) => ({
    slNo: idx + 1,
    voucherNo: r.voucherNo ?? "",
    date: r.date ?? "",
    fromCurrentAcLabel: r.fromCurrentAcLabel ?? "",
    toCurrentAcLabel: r.toCurrentAcLabel ?? "",
    remarks: r.remarks ?? "",
    amount: r.amount ?? ""
  }));

  return {
    rows,
    truncated: (rawRows || []).length >= limit
  };
}
