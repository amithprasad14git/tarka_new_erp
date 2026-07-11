// Report — Settled Cases. All SQL and filter WHERE logic for this report only.

/**
 * Final case statuses except Returned; caseStatusUpdatedDate in selected date range.
 * Exports buildSettledCaseStatusWhereSql for reuse (e.g. Region Wise Cummulative).
 * Config: report_settled_cases.
 */

import pool from "../db";
import { FINAL_CASE_STATUSES, normalizeNciCaseStatusLabel } from "../modules/newCaseInwardCaseStatus";
import { branchLabelSelectSql } from "./reportBranchLabelSql.js";
import { amountRecoveredSubquerySql } from "./report_part_recovered_cases.js";
import { appendNciUnitFilterIfSelected } from "./nciReportDimensionFilters.js";
import { escapeSqlTableId } from "../sqlModuleTable";
import { toYyyyMmDdForSqlDateField } from "../sqlDateFieldValue";

const RETURNED_STATUS_NORM = normalizeNciCaseStatusLabel("Returned");

/** Detailed case-level rows (default data type). */
export const SETTLED_CASES_DATA_TYPE_DETAILED = "Detailed";
/** Aggregated summary rows by bank / unit dimensions. */
export const SETTLED_CASES_DATA_TYPE_SUMMARY = "Summary";

/**
 * @param {unknown} dataType
 * @returns {"Detailed" | "Summary"}
 */
export function normalizeSettledCasesDataType(dataType) {
  return String(dataType ?? SETTLED_CASES_DATA_TYPE_DETAILED).trim() === SETTLED_CASES_DATA_TYPE_SUMMARY
    ? SETTLED_CASES_DATA_TYPE_SUMMARY
    : SETTLED_CASES_DATA_TYPE_DETAILED;
}

/** Safe quoted table names for settled-cases NCI joins. */
function sqlTableIds() {
  return {
    nci: escapeSqlTableId("new_case_inward"),
    um: escapeSqlTableId("unit_master"),
    br: escapeSqlTableId("branch_master"),
    rbo: escapeSqlTableId("rbo_master"),
    hz: escapeSqlTableId("ho_zo_master"),
    bank: escapeSqlTableId("bank_master"),
    lvm: escapeSqlTableId("lookup_value_master"),
    ar: escapeSqlTableId("new_case_inward_amount_recovered")
  };
}

/**
 * Final case statuses from FINAL_CASE_STATUSES, excluding Returned.
 * @returns {{ sql: string, values: string[] }}
 */
export function buildSettledCaseStatusWhereSql() {
  const labels = (FINAL_CASE_STATUSES || [])
    .map((s) => normalizeNciCaseStatusLabel(s))
    .filter((s) => s && s !== RETURNED_STATUS_NORM);
  if (!labels.length) {
    return { sql: "1=0", values: [] };
  }
  const placeholders = labels.map(() => "?").join(", ");
  return {
    sql: `LOWER(TRIM(cs.lookupValue)) IN (${placeholders})`,
    values: labels
  };
}

/** SELECT for settled case detail rows (settled date = caseStatusUpdatedDate). */
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
    nci.caseStatusUpdatedDate AS settledDate,
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
  INNER JOIN ${t.lvm} cs ON cs.id = nci.caseStatus
  INNER JOIN ${t.lvm} rf ON rf.id = nci.receivedFrom
  INNER JOIN ${t.lvm} lt ON lt.id = nci.loanType
  LEFT JOIN ${t.lvm} ns ON ns.id = nci.npaStatus
`;
}

/**
 * @param {Record<string, unknown>} filters
 * @returns {{ whereSql: string, values: unknown[] }}
 */
export function buildSettledCasesReportWhereSql(filters) {
  const parts = [];
  const values = [];

  const from = toYyyyMmDdForSqlDateField(filters.fromDate);
  const to = toYyyyMmDdForSqlDateField(filters.toDate);
  parts.push("DATE(nci.caseStatusUpdatedDate) >= ?");
  parts.push("DATE(nci.caseStatusUpdatedDate) <= ?");
  values.push(from, to);

  const settledCase = buildSettledCaseStatusWhereSql();
  parts.push(settledCase.sql);
  values.push(...settledCase.values);

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
 * Aggregated SELECT for Summary data type (case count / recovered / NPA by bank × RBO).
 * @returns {string}
 */
export function buildSummaryAggregatedSql() {
  const t = sqlTableIds();
  const recovered = amountRecoveredSubquerySql();
  return `
SELECT
  b.bank_id,
  b.bank_label,
  b.rbo_ro_id,
  b.rbo_ro_label,
  SUM(b.no_of_cases) AS case_count,
  SUM(b.amount_recovered) AS amount_recovered,
  SUM(b.npa_reduced) AS npa_reduced
FROM (
  SELECT
    bank.id AS bank_id,
    bank.bankCode AS bank_label,
    rbo.id AS rbo_ro_id,
    rbo.shortCode AS rbo_ro_label,
    1 AS no_of_cases,
    ${recovered} AS amount_recovered,
    nci.closureBalance AS npa_reduced
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
  WHERE /*INNER_WHERE*/
) b
GROUP BY b.bank_id, b.bank_label, b.rbo_ro_id, b.rbo_ro_label
ORDER BY b.bank_label, b.rbo_ro_label
`;
}

/** Maps summary SQL rows to Settled Cases Summary output shape. */
function mapSummaryRows(rawRows) {
  return (rawRows || []).map((r, idx) => ({
    slNo: idx + 1,
    bankLabel: r.bank_label ?? "",
    rboRoLabel: r.rbo_ro_label ?? "",
    caseCount: Number(r.case_count) || 0,
    amountRecovered: r.amount_recovered,
    closureBalance: r.npa_reduced
  }));
}

/**
 * Runs Settled Cases (Detailed or Summary) for the selected settled-date range.
 * @param {object} user
 * @param {Record<string, unknown>} filters
 * @param {{ limit?: number }} ctx
 */
export async function runReport(user, filters, ctx = {}) {
  const { whereSql, values } = buildSettledCasesReportWhereSql(filters);
  const limit = Math.min(Math.max(Number(ctx.limit) || 50000, 1), 50000);

  if (normalizeSettledCasesDataType(filters.dataType) === SETTLED_CASES_DATA_TYPE_SUMMARY) {
    const sql = buildSummaryAggregatedSql().replace("/*INNER_WHERE*/", whereSql);
    const [rawRows] = await pool.query(sql, values);
    const rows = mapSummaryRows(rawRows);
    return {
      rows,
      truncated: false
    };
  }

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
    settledDate: r.settledDate,
    caseStatusLabel: r.caseStatusLabel ?? ""
  }));

  return {
    rows,
    truncated: (rawRows || []).length >= limit
  };
}

