// Report — Returned Cases. All SQL and filter WHERE logic for this report only.

/**
 * Cases with Returned status; caseStatusUpdatedDate (Return Date) in range.
 * Config: report_returned_cases.
 */

import mysql from "mysql2";
import pool from "../db";
import { normalizeNciCaseStatusLabel } from "../modules/newCaseInwardCaseStatus";
import { branchLabelSelectSql } from "./reportBranchLabelSql.js";
import { amountRecoveredSubquerySql } from "./report_part_recovered_cases.js";
import { getScopeForAction } from "../rbac";
import { normalizeDataScope } from "../rowScope";
import { escapeSqlTableId } from "../sqlModuleTable";
import { toYyyyMmDdForSqlDateField } from "../sqlDateFieldValue";

const REPORT_KEY = "report_returned_cases";
const RETURNED_STATUS_NORM = normalizeNciCaseStatusLabel("Returned");

function sqlTableIds() {
  return {
    nci: escapeSqlTableId("new_case_inward"),
    um: escapeSqlTableId("unit_master"),
    br: escapeSqlTableId("branch_master"),
    rbo: escapeSqlTableId("rbo_master"),
    hz: escapeSqlTableId("ho_zo_master"),
    bank: escapeSqlTableId("bank_master"),
    lvm: escapeSqlTableId("lookup_value_master")
  };
}

/**
 * Only cases with Case Status label "Returned" (from FINAL_CASE_STATUSES).
 * @returns {{ sql: string, values: string[] }}
 */
export function buildReturnedCaseStatusWhereSql() {
  return {
    sql: "LOWER(TRIM(cs.lookupValue)) = ?",
    values: [RETURNED_STATUS_NORM]
  };
}

function buildSelectSql() {
  const t = sqlTableIds();
  const recovered = amountRecoveredSubquerySql();
  const branchLabel = branchLabelSelectSql("br", "bank");
  return `
  SELECT
    nci.entrustmentDate AS entrustmentDate,
    nci.caseNo AS caseNo,
    nci.borrower AS borrower,
    nci.loanAccountNo AS loanAccountNo,
    nci.closureBalance AS closureBalance,
    nci.caseStatusUpdatedDate AS returnDate,
    nci.caseStatusRemarks AS caseStatusRemarks,
    hz.shortCode AS hoZoLabel,
    rbo.shortCode AS rboRoLabel,
    ${branchLabel},
    rf.lookupValue AS receivedFromLabel,
    lt.lookupValue AS loanTypeLabel,
    ns.lookupValue AS npaStatusLabel,
    nci.npaDate AS npaDate,
    ${recovered} AS amountRecovered
  FROM ${t.nci} nci
  INNER JOIN ${t.um} um ON um.id = nci.unit
  INNER JOIN ${t.br} br ON br.id = nci.branch
  INNER JOIN ${t.rbo} rbo ON rbo.id = br.rbo_ro
  INNER JOIN ${t.hz} hz ON hz.id = rbo.ho_zo
  INNER JOIN ${t.bank} bank ON bank.id = hz.bank
  INNER JOIN ${t.lvm} cs ON cs.id = nci.caseStatus
  INNER JOIN ${t.lvm} rf ON rf.id = nci.receivedFrom
  INNER JOIN ${t.lvm} lt ON lt.id = nci.loanType
  LEFT JOIN ${t.lvm} ns ON ns.id = nci.npaStatus
`;
}

/**
 * @param {object} user
 * @param {Record<string, unknown>} filters
 * @returns {Promise<{ whereSql: string, values: unknown[] }>}
 */
export async function buildReturnedCasesReportWhereSql(user, filters) {
  const parts = [];
  const values = [];

  const from = toYyyyMmDdForSqlDateField(filters.fromDate);
  const to = toYyyyMmDdForSqlDateField(filters.toDate);
  parts.push("DATE(nci.caseStatusUpdatedDate) >= ?");
  parts.push("DATE(nci.caseStatusUpdatedDate) <= ?");
  values.push(from, to);

  const returnedCase = buildReturnedCaseStatusWhereSql();
  parts.push(returnedCase.sql);
  values.push(...returnedCase.values);

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
  const { whereSql, values } = await buildReturnedCasesReportWhereSql(user, filters);
  const limit = Math.min(Math.max(Number(ctx.limit) || 50000, 1), 50000);
  const sql = `${buildSelectSql()} WHERE ${whereSql} ORDER BY nci.caseStatusUpdatedDate ASC, nci.caseNo ASC LIMIT ?`;
  const [rawRows] = await pool.query(sql, [...values, limit]);

  const rows = (rawRows || []).map((r, idx) => ({
    slNo: idx + 1,
    entrustmentDate: r.entrustmentDate,
    caseNo: r.caseNo ?? "",
    hoZoLabel: r.hoZoLabel ?? "",
    rboRoLabel: r.rboRoLabel ?? "",
    branchLabel: r.branchLabel ?? "",
    receivedFromLabel: r.receivedFromLabel ?? "",
    borrower: r.borrower ?? "",
    loanAccountNo: r.loanAccountNo ?? "",
    loanTypeLabel: r.loanTypeLabel ?? "",
    npaStatusLabel: r.npaStatusLabel ?? "",
    npaDate: r.npaDate,
    closureBalance: r.closureBalance,
    amountRecovered: r.amountRecovered,
    returnDate: r.returnDate,
    caseStatusRemarks: r.caseStatusRemarks ?? ""
  }));

  return {
    rows,
    truncated: (rawRows || []).length >= limit
  };
}
