// Report — New Case Inward Register. All SQL and filter WHERE logic for this report only.

/**
 * Case Inward Register — lists new_case_inward rows with branch/bank/lookup joins.
 * Config: config/reports.js → report_new_case_inward_register. See docs/REPORTS.md.
 */

import mysql from "mysql2";
import pool from "../db";
import { branchLabelSelectSql } from "./reportBranchLabelSql.js";
import { getScopeForAction } from "../rbac";
import { normalizeDataScope } from "../rowScope";
import { escapeSqlTableId } from "../sqlModuleTable";
import { toYyyyMmDdForSqlDateField } from "../sqlDateFieldValue";

const REPORT_KEY = "report_new_case_inward_register";

function sqlTableIds() {
  return {
    nci: escapeSqlTableId("new_case_inward"),
    um: escapeSqlTableId("unit_master"),
    br: escapeSqlTableId("branch_master"),
    rbo: escapeSqlTableId("rbo_master"),
    hz: escapeSqlTableId("ho_zo_master"),
    bank: escapeSqlTableId("bank_master"),
    lt: escapeSqlTableId("lookup_value_master"),
    ns: escapeSqlTableId("lookup_value_master")
  };
}

function buildSelectSql() {
  const t = sqlTableIds();
  const branchLabel = branchLabelSelectSql("br", "bank");
  return `
  SELECT
    nci.entrustmentDate AS entrustmentDate,
    nci.caseNo AS caseNo,
    nci.borrower AS borrower,
    nci.loanAccountNo AS loanAccountNo,
    nci.closureBalance AS closureBalance,
    um.unitName AS unitLabel,
    bank.bankCode AS bankLabel,
    hz.shortCode AS hoZoLabel,
    rbo.shortCode AS rboRoLabel,
    ${branchLabel},
    lt.lookupValue AS loanTypeLabel,
    ns.lookupValue AS npaStatusLabel,
    nci.npaDate AS npaDate
  FROM ${t.nci} nci
  INNER JOIN ${t.um} um ON um.id = nci.unit
  INNER JOIN ${t.br} br ON br.id = nci.branch
  INNER JOIN ${t.rbo} rbo ON rbo.id = br.rbo_ro
  INNER JOIN ${t.hz} hz ON hz.id = rbo.ho_zo
  INNER JOIN ${t.bank} bank ON bank.id = hz.bank
  INNER JOIN ${t.lt} lt ON lt.id = nci.loanType
  LEFT JOIN ${t.ns} ns ON ns.id = nci.npaStatus
`;
}

/**
 * @param {object} user
 * @param {Record<string, unknown>} filters
 */
async function buildWhere(user, filters) {
  const parts = [];
  const values = [];

  const from = toYyyyMmDdForSqlDateField(filters.fromDate);
  const to = toYyyyMmDdForSqlDateField(filters.toDate);
  parts.push("nci.entrustmentDate >= ?");
  parts.push("nci.entrustmentDate <= ?");
  values.push(from, to);

  if (filters.unit && Number.isFinite(Number(filters.unit))) {
    parts.push("nci.unit = ?");
    values.push(Number(filters.unit));
  }
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
  if (filters.branch && Number.isFinite(Number(filters.branch))) {
    parts.push("nci.branch = ?");
    values.push(Number(filters.branch));
  }
  if (filters.loanCategory && Number.isFinite(Number(filters.loanCategory))) {
    parts.push("nci.loanCategory = ?");
    values.push(Number(filters.loanCategory));
  }
  if (filters.loanType && Number.isFinite(Number(filters.loanType))) {
    parts.push("nci.loanType = ?");
    values.push(Number(filters.loanType));
  }
  if (filters.npaStatus && Number.isFinite(Number(filters.npaStatus))) {
    parts.push("nci.npaStatus = ?");
    values.push(Number(filters.npaStatus));
  }
  if (filters.receivedFrom && Number.isFinite(Number(filters.receivedFrom))) {
    parts.push("nci.receivedFrom = ?");
    values.push(Number(filters.receivedFrom));
  }
  if (filters.fileMaintenance && Number.isFinite(Number(filters.fileMaintenance))) {
    parts.push("nci.fileMaintenance = ?");
    values.push(Number(filters.fileMaintenance));
  }

  await appendNciRowScope(user, parts, values);

  return { whereSql: parts.join(" AND "), values };
}

/** Row scope on new_case_inward.createdBy (qualified for joined query). */
async function appendNciRowScope(user, parts, values) {
  const scope = normalizeDataScope(await getScopeForAction(user, REPORT_KEY, "view"));
  if (scope === "all") return;
  if (user && Number(user.role) === 1) return;

  if (scope === "own") {
    parts.push("nci.createdBy = ?");
    values.push(user.id);
    return;
  }

  if (scope === "unit") {
    const uid = user?.unit != null && user.unit !== "" ? Number(user.unit) : null;
    if (!Number.isFinite(uid)) {
      parts.push("1=0");
      return;
    }
    const ut = escapeSqlTableId("users");
    parts.push(
      `nci.createdBy IN (SELECT ${mysql.escapeId("id")} FROM ${ut} WHERE ${mysql.escapeId("unit")} = ?)`
    );
    values.push(uid);
  }
}

/**
 * @param {object} user
 * @param {Record<string, unknown>} filters
 * @param {{ limit?: number }} ctx
 */
export async function runReport(user, filters, ctx = {}) {
  const { whereSql, values } = await buildWhere(user, filters);
  const limit = Math.min(Math.max(Number(ctx.limit) || 50000, 1), 50000);
  const sql = `${buildSelectSql()} WHERE ${whereSql} ORDER BY nci.entrustmentDate ASC, nci.caseNo ASC LIMIT ?`;
  const [rawRows] = await pool.query(sql, [...values, limit]);

  const rows = (rawRows || []).map((r, idx) => ({
    slNo: idx + 1,
    entrustmentDate: r.entrustmentDate,
    unitLabel: r.unitLabel ?? "",
    caseNo: r.caseNo ?? "",
    bankLabel: r.bankLabel ?? "",
    hoZoLabel: r.hoZoLabel ?? "",
    rboRoLabel: r.rboRoLabel ?? "",
    branchLabel: r.branchLabel ?? "",
    borrower: r.borrower ?? "",
    loanAccountNo: r.loanAccountNo ?? "",
    loanTypeLabel: r.loanTypeLabel ?? "",
    npaStatusLabel: r.npaStatusLabel ?? "",
    npaDate: r.npaDate,
    closureBalance: r.closureBalance
  }));

  return {
    rows,
    truncated: (rawRows || []).length >= limit
  };
}
