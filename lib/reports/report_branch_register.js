// Report — Branch Register. All SQL and filter WHERE logic for this report only.

/**
 * Branch Register — branch_master with bank, HO/ZO, RBO joins. Config: report_branch_register.
 */

import pool from "../db";
import { escapeSqlTableId } from "../sqlModuleTable";

function sqlTableIds() {
  return {
    br: escapeSqlTableId("branch_master"),
    rbo: escapeSqlTableId("rbo_master"),
    hz: escapeSqlTableId("ho_zo_master"),
    bank: escapeSqlTableId("bank_master")
  };
}

function buildSelectSql() {
  const t = sqlTableIds();
  return `
  SELECT
    bank.bankName AS bankLabel,
    hz.shortCode AS hoZoLabel,
    rbo.shortCode AS rboRoLabel,
    br.branchCode AS branchCode,
    br.branchName AS branchName,
    br.place AS place,
    br.active AS active
  FROM ${t.br} br
  INNER JOIN ${t.rbo} rbo ON rbo.id = br.rbo_ro
  INNER JOIN ${t.hz} hz ON hz.id = rbo.ho_zo
  INNER JOIN ${t.bank} bank ON bank.id = hz.bank
`;
}

/**
 * @param {Record<string, unknown>} filters
 */
function buildWhere(filters) {
  const parts = ["1=1"];
  const values = [];

  if (filters.bank && Number.isFinite(Number(filters.bank))) {
    parts.push("bank.id = ?");
    values.push(Number(filters.bank));
  }
  if (filters.ho_zo && Number.isFinite(Number(filters.ho_zo))) {
    parts.push("hz.id = ?");
    values.push(Number(filters.ho_zo));
  }
  if (filters.rbo_ro && Number.isFinite(Number(filters.rbo_ro))) {
    parts.push("rbo.id = ?");
    values.push(Number(filters.rbo_ro));
  }
  const active = filters.active != null ? String(filters.active).trim() : "";
  if (active === "Yes" || active === "No") {
    parts.push("br.active = ?");
    values.push(active);
  }

  return { whereSql: parts.join(" AND "), values };
}

/**
 * @param {object} user
 * @param {Record<string, unknown>} filters
 * @param {{ limit?: number }} ctx
 */
export async function runReport(user, filters, ctx = {}) {
  void user;
  const { whereSql, values } = buildWhere(filters);
  const limit = Math.min(Math.max(Number(ctx.limit) || 50000, 1), 50000);
  const sql = `${buildSelectSql()} WHERE ${whereSql} ORDER BY bank.bankName ASC, hz.shortCode ASC, rbo.shortCode ASC, br.branchCode ASC LIMIT ?`;
  const [rawRows] = await pool.query(sql, [...values, limit]);

  const rows = (rawRows || []).map((r, idx) => ({
    slNo: idx + 1,
    bankLabel: r.bankLabel ?? "",
    hoZoLabel: r.hoZoLabel ?? "",
    rboRoLabel: r.rboRoLabel ?? "",
    branchCode: r.branchCode ?? "",
    branchName: r.branchName ?? "",
    place: r.place ?? "",
    active: r.active ?? ""
  }));

  return {
    rows,
    truncated: (rawRows || []).length >= limit
  };
}
