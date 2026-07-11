// Report — Part Recovered Cases. All SQL and filter WHERE logic for this report only.

/**
 * Open cases with amount recovered > 0. Config: report_part_recovered_cases.
 */

import pool from "../db";
import { branchLabelSelectSql } from "./reportBranchLabelSql.js";
import { buildOpenCaseStatusWhereSql } from "./report_pending_cases_on_hand.js";
import { appendNciUnitFilterIfSelected } from "./nciReportDimensionFilters.js";
import { escapeSqlTableId } from "../sqlModuleTable";
import { toYyyyMmDdForSqlDateField } from "../sqlDateFieldValue";

/** Safe quoted table names for part-recovered NCI joins. */
function sqlTableIds() {
  return {
    nci: escapeSqlTableId("new_case_inward"),
    ar: escapeSqlTableId("new_case_inward_amount_recovered"),
    um: escapeSqlTableId("unit_master"),
    br: escapeSqlTableId("branch_master"),
    rbo: escapeSqlTableId("rbo_master"),
    hz: escapeSqlTableId("ho_zo_master"),
    bank: escapeSqlTableId("bank_master"),
    lvm: escapeSqlTableId("lookup_value_master")
  };
}

/** @returns {string} correlated subquery for total recovered per case */
export function amountRecoveredSubquerySql() {
  const t = sqlTableIds();
  return `(SELECT COALESCE(SUM(ar.recoveredAmount), 0)
     FROM ${t.ar} ar
     WHERE ar.caseInwardId = nci.id)`;
}

/**
 * Predicate: lifetime cash recovered must be greater than zero.
 * @returns {{ sql: string, values: [] }}
 */
export function buildAmountRecoveredGtZeroWhereSql() {
  return {
    sql: `${amountRecoveredSubquerySql()} > 0`,
    values: []
  };
}

/** SELECT for open cases that have some recovery (not fully settled). */
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
    nci.caseStatusRemarks AS caseStatusRemarks,
    hz.shortCode AS hoZoLabel,
    rbo.shortCode AS rboRoLabel,
    ${branchLabel},
    rf.lookupValue AS receivedFromLabel,
    lt.lookupValue AS loanTypeLabel,
    ns.lookupValue AS npaStatusLabel,
    nci.npaDate AS npaDate,
    cs.lookupValue AS caseStatusLabel,
    ${recovered} AS amountRecovered
  FROM ${t.nci} nci
  INNER JOIN ${t.um} um ON um.id = nci.unit
  INNER JOIN ${t.br} br ON br.id = nci.branch
  INNER JOIN ${t.rbo} rbo ON rbo.id = br.rbo_ro
  INNER JOIN ${t.hz} hz ON hz.id = rbo.ho_zo
  INNER JOIN ${t.bank} bank ON bank.id = hz.bank
  INNER JOIN ${t.lvm} rf ON rf.id = nci.receivedFrom
  INNER JOIN ${t.lvm} lt ON lt.id = nci.loanType
  LEFT JOIN ${t.lvm} ns ON ns.id = nci.npaStatus
  LEFT JOIN ${t.lvm} cs ON cs.id = nci.caseStatus
`;
}

/**
 * As-on-date + open status + recovered > 0 + optional NCI dimension filters.
 * @param {Record<string, unknown>} filters
 */
function buildWhere(filters) {
  const parts = [];
  const values = [];

  const asOn = toYyyyMmDdForSqlDateField(filters.asOnDate);
  parts.push("nci.entrustmentDate <= ?");
  values.push(asOn);

  const openCase = buildOpenCaseStatusWhereSql();
  parts.push(openCase.sql);
  values.push(...openCase.values);

  const recoveredGtZero = buildAmountRecoveredGtZeroWhereSql();
  parts.push(recoveredGtZero.sql);

  appendNciUnitFilterIfSelected(filters, parts, values);
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

  return { whereSql: parts.join(" AND "), values };
}

/**
 * Runs Part Recovered Cases as of the selected date (open + recovered > 0).
 * @param {object} user
 * @param {Record<string, unknown>} filters
 * @param {{ limit?: number }} ctx
 */
export async function runReport(user, filters, ctx = {}) {
  const { whereSql, values } = buildWhere(filters);
  const limit = Math.min(Math.max(Number(ctx.limit) || 50000, 1), 50000);
  const sql = `${buildSelectSql()} WHERE ${whereSql} ORDER BY nci.entrustmentDate ASC, nci.caseNo ASC LIMIT ?`;
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
    caseStatusLabel: r.caseStatusLabel ?? "",
    amountRecovered: r.amountRecovered,
    caseStatusRemarks: r.caseStatusRemarks ?? ""
  }));

  return {
    rows,
    truncated: (rawRows || []).length >= limit
  };
}

