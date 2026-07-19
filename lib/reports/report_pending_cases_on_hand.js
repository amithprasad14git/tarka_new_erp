// Report — Pending Cases on Hand. All SQL and filter WHERE logic for this report only.

/**
 * Open cases as on date (not in FINAL_CASE_STATUSES). Config: report_pending_cases_on_hand.
 * Data Type Detailed = case-level rows; Summary = aggregated by RBO × Branch.
 */

import pool from "../db";
import { FINAL_CASE_STATUSES } from "../modules/newCaseInwardCaseStatus";
import { branchLabelSelectSql } from "./reportBranchLabelSql.js";
import { appendNciUnitFilterIfSelected } from "./nciReportDimensionFilters.js";
import { escapeSqlTableId } from "../sqlModuleTable";
import { toYyyyMmDdForSqlDateField } from "../sqlDateFieldValue";

/** Detailed case-level rows (default data type). */
export const PENDING_CASES_DATA_TYPE_DETAILED = "Detailed";
/** Aggregated summary rows by RBO × Branch. */
export const PENDING_CASES_DATA_TYPE_SUMMARY = "Summary";

/**
 * @param {unknown} dataType
 * @returns {"Detailed" | "Summary"}
 */
export function normalizePendingCasesDataType(dataType) {
  return String(dataType ?? PENDING_CASES_DATA_TYPE_DETAILED).trim() === PENDING_CASES_DATA_TYPE_SUMMARY
    ? PENDING_CASES_DATA_TYPE_SUMMARY
    : PENDING_CASES_DATA_TYPE_DETAILED;
}

/** Safe quoted table names for pending-cases NCI joins. */
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

/**
 * SQL fragment + bind values for open/ongoing cases (excludes FINAL_CASE_STATUSES including Returned).
 * @returns {{ sql: string, values: string[] }}
 */
export function buildOpenCaseStatusWhereSql() {
  const labels = (FINAL_CASE_STATUSES || [])
    .map((s) => String(s || "").trim().toLowerCase())
    .filter(Boolean);
  if (!labels.length) {
    return { sql: "1=1", values: [] };
  }
  const placeholders = labels.map(() => "?").join(", ");
  return {
    sql: `(nci.caseStatus IS NULL OR cs.lookupValue IS NULL OR LOWER(TRIM(cs.lookupValue)) NOT IN (${placeholders}))`,
    values: labels
  };
}

/** Lifetime recovered amount subquery (same grain as Detailed SELECT). */
function amountRecoveredSubquerySql() {
  const t = sqlTableIds();
  return `(SELECT COALESCE(SUM(ar.recoveredAmount), 0)
     FROM ${t.ar} ar
     WHERE ar.caseInwardId = nci.id)`;
}

/** SELECT for open cases with bank hierarchy, lookups, and lifetime recovered amount. */
function buildSelectSql() {
  const t = sqlTableIds();
  const branchLabel = branchLabelSelectSql("br", "bank");
  const recovered = amountRecoveredSubquerySql();
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
    lc.lookupValue AS loanCategoryLabel,
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
  LEFT JOIN ${t.lvm} lc ON lc.id = nci.loanCategory
  INNER JOIN ${t.lvm} lt ON lt.id = nci.loanType
  LEFT JOIN ${t.lvm} ns ON ns.id = nci.npaStatus
  LEFT JOIN ${t.lvm} cs ON cs.id = nci.caseStatus
`;
}

/**
 * Aggregated SELECT for Summary data type (case count / recovered / closure by RBO × Branch).
 * @returns {string}
 */
export function buildSummaryAggregatedSql() {
  const t = sqlTableIds();
  const recovered = amountRecoveredSubquerySql();
  const branchLabel = branchLabelSelectSql("br", "bank");
  return `
SELECT
  b.rbo_ro_id,
  b.rbo_ro_label,
  b.branch_id,
  b.branch_label,
  SUM(b.no_of_cases) AS case_count,
  SUM(b.amount_recovered) AS amount_recovered,
  SUM(b.closure_balance) AS closure_balance
FROM (
  SELECT
    rbo.id AS rbo_ro_id,
    rbo.shortCode AS rbo_ro_label,
    br.id AS branch_id,
    ${branchLabel.replace(" AS branchLabel", " AS branch_label")},
    1 AS no_of_cases,
    ${recovered} AS amount_recovered,
    nci.closureBalance AS closure_balance
  FROM ${t.nci} nci
  INNER JOIN ${t.um} um ON um.id = nci.unit
  INNER JOIN ${t.br} br ON br.id = nci.branch
  INNER JOIN ${t.rbo} rbo ON rbo.id = br.rbo_ro
  INNER JOIN ${t.hz} hz ON hz.id = rbo.ho_zo
  INNER JOIN ${t.bank} bank ON bank.id = hz.bank
  INNER JOIN ${t.lvm} rf ON rf.id = nci.receivedFrom
  LEFT JOIN ${t.lvm} lc ON lc.id = nci.loanCategory
  INNER JOIN ${t.lvm} lt ON lt.id = nci.loanType
  LEFT JOIN ${t.lvm} ns ON ns.id = nci.npaStatus
  LEFT JOIN ${t.lvm} cs ON cs.id = nci.caseStatus
  WHERE /*INNER_WHERE*/
) b
GROUP BY b.rbo_ro_id, b.rbo_ro_label, b.branch_id, b.branch_label
ORDER BY b.rbo_ro_label, b.branch_label
`;
}

/**
 * As-on-date + open status + optional NCI dimension filters.
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

/** Maps summary SQL rows to Pending Cases Summary output shape. */
function mapSummaryRows(rawRows) {
  return (rawRows || []).map((r, idx) => ({
    slNo: idx + 1,
    rboRoLabel: r.rbo_ro_label ?? "",
    branchLabel: r.branch_label ?? "",
    caseCount: Number(r.case_count) || 0,
    amountRecovered: r.amount_recovered,
    closureBalance: r.closure_balance
  }));
}

/**
 * Runs Pending Cases on Hand as of the selected date (open statuses only).
 * @param {object} user
 * @param {Record<string, unknown>} filters
 * @param {{ limit?: number }} ctx
 */
export async function runReport(user, filters, ctx = {}) {
  const { whereSql, values } = buildWhere(filters);
  const limit = Math.min(Math.max(Number(ctx.limit) || 50000, 1), 50000);

  if (normalizePendingCasesDataType(filters.dataType) === PENDING_CASES_DATA_TYPE_SUMMARY) {
    const sql = buildSummaryAggregatedSql().replace("/*INNER_WHERE*/", whereSql);
    const [rawRows] = await pool.query(sql, values);
    const rows = mapSummaryRows(rawRows);
    return {
      rows,
      truncated: false
    };
  }

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
    loanCategoryLabel: r.loanCategoryLabel ?? "",
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
