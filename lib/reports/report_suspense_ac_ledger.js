// Report — Suspense AC Ledger. All SQL and filter WHERE logic for this report only.

/**
 * Ledger rows from accounts_suspense_entry with month range and optional transaction/NPA filters.
 * Config: report_suspense_ac_ledger.
 */

import pool from "../db";
import { escapeSqlTableId } from "../sqlModuleTable";
import { monthEndYmd, monthStartYmd, validateMonthRange } from "./monthFilterRange";

const DATE_FORMAT = "%d-%m-%Y";

function sqlTableIds() {
  return {
    ase: escapeSqlTableId("accounts_suspense_entry"),
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
 * @returns {{ whereSql: string, values: unknown[] }}
 */
export function buildSuspenseAcLedgerWhereSql(filters) {
  const parts = [];
  const values = [];

  const from = monthStartYmd(String(filters.fromMonth || "").trim());
  const to = monthEndYmd(String(filters.toMonth || "").trim());
  parts.push("DATE(ase.date) >= ?");
  parts.push("DATE(ase.date) <= ?");
  values.push(from, to);

  const transactionType = String(filters.transactionType || "").trim();
  if (transactionType === "Debit" || transactionType === "Credit") {
    parts.push("ase.transactionType = ?");
    values.push(transactionType);
  }

  if (filters.npaCurrentAc && Number.isFinite(Number(filters.npaCurrentAc))) {
    parts.push("ase.npaCurrentAc = ?");
    values.push(Number(filters.npaCurrentAc));
  }

  return { whereSql: parts.join(" AND "), values };
}

function buildSelectSql() {
  const t = sqlTableIds();
  return `
  SELECT
    ase.voucherNo AS voucherNo,
    DATE_FORMAT(ase.date, '${DATE_FORMAT}') AS date,
    ase.transactionType AS transactionType,
    cam.branch AS npaCurrentAcLabel,
    ase.remarks AS remarks,
    ase.amount AS amount
  FROM ${t.ase} ase
  LEFT JOIN ${t.cam} cam ON cam.id = ase.npaCurrentAc
`;
}

/**
 * @param {object} user
 * @param {Record<string, unknown>} filters
 * @param {{ limit?: number }} ctx
 */
export async function runReport(user, filters, ctx = {}) {
  void user;
  const { whereSql, values } = buildSuspenseAcLedgerWhereSql(filters);
  const limit = Math.min(Math.max(Number(ctx.limit) || 50000, 1), 50000);
  const sql = `${buildSelectSql()} WHERE ${whereSql} ORDER BY ase.date ASC, ase.id ASC LIMIT ?`;
  const [rawRows] = await pool.query(sql, [...values, limit]);

  const rows = (rawRows || []).map((r, idx) => ({
    slNo: idx + 1,
    voucherNo: r.voucherNo ?? "",
    date: r.date ?? "",
    transactionType: r.transactionType ?? "",
    npaCurrentAcLabel: r.npaCurrentAcLabel ?? "",
    remarks: r.remarks ?? "",
    amount: r.amount ?? ""
  }));

  return {
    rows,
    truncated: (rawRows || []).length >= limit
  };
}
