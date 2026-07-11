// Dashboard — Regional Performance FY settled-case SQL aggregation.

/**
 * Builds KPI totals, loan-type pie, region bars, and month-wise settled trend.
 *
 * Case rules (same family as Region Wise Cummulative report):
 * - Final settled status, excluding Returned
 * - caseStatusUpdatedDate within active FY
 * - Lifetime cash recovered > 0
 *
 * Pie groups by nci.loanType (lookup), not loanCategory.
 * Guide: README.md#5a-landing-dashboards
 */

import pool from "../../db";
import { escapeSqlTableId } from "../../sqlModuleTable";
import { toYyyyMmDdForSqlDateField } from "../../sqlDateFieldValue";
import { buildSettledCaseStatusWhereSql } from "../../reports/report_settled_cases.js";

/** Safe quoted table names for SQL in this dashboard. */
function sqlTableIds() {
  return {
    nci: escapeSqlTableId("new_case_inward"),
    ar: escapeSqlTableId("new_case_inward_amount_recovered"),
    br: escapeSqlTableId("branch_master"),
    rbo: escapeSqlTableId("rbo_master"),
    lvm: escapeSqlTableId("lookup_value_master")
  };
}

/** Builds `?, ?, ?` placeholders for IN (unitIds). */
function unitInClause(unitCount) {
  return unitCount > 0 ? Array(unitCount).fill("?").join(", ") : "?";
}

/**
 * Converts FY start/end to SQL date strings for WHERE clauses.
 * @param {{ startDate: string, endDate: string }} fy
 */
function fyBounds(fy) {
  return {
    from: toYyyyMmDdForSqlDateField(fy.startDate),
    to: toYyyyMmDdForSqlDateField(fy.endDate)
  };
}

/**
 * One row per settled case in FY (used as inner subquery for all four aggregations).
 * @param {number[]} unitIds
 * @param {{ startDate: string, endDate: string }} fy
 */
function buildSettledCasesSubquery(unitIds, fy) {
  const t = sqlTableIds();
  const placeholders = unitInClause(unitIds.length);
  const { from, to } = fyBounds(fy);
  // Reuse settled-case status filter from report_settled_cases.js.
  const settled = buildSettledCaseStatusWhereSql();

  const innerSql = `
SELECT
  nci.id AS case_inward_id,
  1 AS no_of_cases,
  lt.id AS loan_type_id,
  lt.lookupValue AS loan_type,
  rbo.id AS rbo_ro_id,
  rbo.shortCode AS rbo_ro,
  DATE_FORMAT(nci.caseStatusUpdatedDate, '%Y-%m') AS month_key,
  CONCAT(DATE_FORMAT(nci.caseStatusUpdatedDate, '%b'), '-', DATE_FORMAT(nci.caseStatusUpdatedDate, '%Y')) AS month_label,
  (SELECT COALESCE(SUM(ar.recoveredAmount), 0)
   FROM ${t.ar} ar
   WHERE ar.caseInwardId = nci.id) AS amount_recovered,
  nci.closureBalance AS npa_reduced
FROM ${t.nci} nci
LEFT JOIN ${t.lvm} lt ON lt.id = nci.loanType
INNER JOIN ${t.br} br ON br.id = nci.branch
INNER JOIN ${t.rbo} rbo ON rbo.id = br.rbo_ro
LEFT JOIN ${t.lvm} cs ON cs.id = nci.caseStatus
WHERE nci.unit IN (${placeholders})
  AND nci.caseStatusUpdatedDate >= ?
  AND nci.caseStatusUpdatedDate <= ?
  AND ${settled.sql}`;

  return {
    // Outer wrap drops cases with zero lifetime recovery.
    sql: `SELECT * FROM (${innerSql}) settled WHERE settled.amount_recovered > 0`,
    values: [...unitIds, from, to, ...settled.values]
  };
}

/**
 * Panel 1 — settled case count, cash recovered, NPA reduced (closure balance sum).
 * @param {number[]} unitIds
 * @param {{ startDate: string, endDate: string }} fy
 */
async function loadTotals(unitIds, fy) {
  const base = buildSettledCasesSubquery(unitIds, fy);
  const sql = `
SELECT
  COALESCE(SUM(x.no_of_cases), 0) AS caseCount,
  COALESCE(SUM(x.amount_recovered), 0) AS amountRecovered,
  COALESCE(SUM(x.npa_reduced), 0) AS npaReduced
FROM (${base.sql}) x`;
  const [rows] = await pool.query(sql, base.values);
  return {
    caseCount: Number(rows?.[0]?.caseCount) || 0,
    amountRecovered: Number(rows?.[0]?.amountRecovered) || 0,
    npaReduced: Number(rows?.[0]?.npaReduced) || 0
  };
}

/**
 * Panel 2 — pie chart: group by loan type lookup (Home Loan, etc.).
 * @param {number[]} unitIds
 * @param {{ startDate: string, endDate: string }} fy
 */
async function loadByLoanType(unitIds, fy) {
  const base = buildSettledCasesSubquery(unitIds, fy);
  const sql = `
SELECT
  x.loan_type_id AS loanTypeId,
  x.loan_type AS loanTypeLabel,
  COALESCE(SUM(x.no_of_cases), 0) AS caseCount,
  COALESCE(SUM(x.amount_recovered), 0) AS amountRecovered,
  COALESCE(SUM(x.npa_reduced), 0) AS npaReduced
FROM (${base.sql}) x
GROUP BY x.loan_type_id, x.loan_type
HAVING amountRecovered > 0
ORDER BY x.loan_type`;
  const [rawRows] = await pool.query(sql, base.values);
  return (rawRows || []).map((r) => ({
    loanTypeId: Number(r.loanTypeId) || 0,
    loanTypeLabel: String(r.loanTypeLabel ?? ""),
    caseCount: Number(r.caseCount) || 0,
    amountRecovered: Number(r.amountRecovered) || 0,
    npaReduced: Number(r.npaReduced) || 0
  }));
}

/**
 * Panel 3 — horizontal bars: cash recovered by RBO region (shortCode).
 * @param {number[]} unitIds
 * @param {{ startDate: string, endDate: string }} fy
 */
async function loadByRegion(unitIds, fy) {
  const base = buildSettledCasesSubquery(unitIds, fy);
  const sql = `
SELECT
  x.rbo_ro_id AS regionId,
  x.rbo_ro AS regionLabel,
  COALESCE(SUM(x.no_of_cases), 0) AS caseCount,
  COALESCE(SUM(x.amount_recovered), 0) AS amountRecovered,
  COALESCE(SUM(x.npa_reduced), 0) AS npaReduced
FROM (${base.sql}) x
GROUP BY x.rbo_ro_id, x.rbo_ro
HAVING amountRecovered > 0
ORDER BY x.rbo_ro`;
  const [rawRows] = await pool.query(sql, base.values);
  return (rawRows || []).map((r) => ({
    regionId: Number(r.regionId) || 0,
    regionLabel: String(r.regionLabel ?? ""),
    caseCount: Number(r.caseCount) || 0,
    amountRecovered: Number(r.amountRecovered) || 0,
    npaReduced: Number(r.npaReduced) || 0
  }));
}

/**
 * Panel 4 — column chart: cash recovered by settlement month (caseStatusUpdatedDate).
 * @param {number[]} unitIds
 * @param {{ startDate: string, endDate: string }} fy
 */
async function loadMonthWiseSettled(unitIds, fy) {
  const base = buildSettledCasesSubquery(unitIds, fy);
  const sql = `
SELECT
  x.month_key AS monthKey,
  x.month_label AS monthLabel,
  COALESCE(SUM(x.amount_recovered), 0) AS amountRecovered
FROM (${base.sql}) x
GROUP BY x.month_key, x.month_label
ORDER BY x.month_key`;
  const [rawRows] = await pool.query(sql, base.values);
  return (rawRows || []).map((r) => ({
    monthKey: r.monthKey ?? "",
    monthLabel: r.monthLabel ?? "",
    amountRecovered: Number(r.amountRecovered) || 0
  }));
}

/**
 * Main export — runs four SQL aggregations in parallel for the Regional Performance widget.
 * @param {number[]} unitIds
 * @param {{ startDate: string, endDate: string, yearCode?: string, yearRangeLabel?: string }} fy
 */
export async function aggregateRegionalPerformance(unitIds, fy) {
  const [totals, byLoanType, byRegion, monthWiseSettled] = await Promise.all([
    loadTotals(unitIds, fy),
    loadByLoanType(unitIds, fy),
    loadByRegion(unitIds, fy),
    loadMonthWiseSettled(unitIds, fy)
  ]);

  return {
    financialYear: {
      yearCode: fy.yearCode ?? "",
      yearRangeLabel: fy.yearRangeLabel ?? ""
    },
    totals,
    byLoanType,
    byRegion,
    monthWiseSettled
  };
}

