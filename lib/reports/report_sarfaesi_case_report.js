// Report — SARFAESI Case Report (custom 4-row-per-case layout).

/**
 * Open SARFAESI cases with a sarfaesi_case_status_update record; particulars from
 * active master (sequence) + Amount Recovered + Remarks. Config: report_sarfaesi_case_report.
 */

import pool from "../db";
import {
  SARFAESI_INVOICE_LOAN_CATEGORY_LOOKUP_TYPE,
  SARFAESI_INVOICE_LOAN_CATEGORY_LOOKUP_VALUE
} from "../modules/sarfaesiInvoice";
import { appendNciUnitFilterIfSelected } from "./nciReportDimensionFilters.js";
import { escapeSqlTableId } from "../sqlModuleTable";
import { toYyyyMmDdForSqlDateField } from "../sqlDateFieldValue";
import { branchLabelSelectSql } from "./reportBranchLabelSql.js";
import { buildOpenCaseStatusWhereSql } from "./report_pending_cases_on_hand.js";
import { amountRecoveredSubquerySql } from "./report_part_recovered_cases.js";

export { buildCustomWorkbook } from "./custom/report_sarfaesi_case_report/buildCustomWorkbook.js";

/** Fixed primary field count before dynamic particulars columns in the custom layout. */
const PRIMARY_FIELD_COUNT = 9;

/** Safe quoted table names for SARFAESI case report joins. */
function sqlTableIds() {
  return {
    nci: escapeSqlTableId("new_case_inward"),
    scsu: escapeSqlTableId("sarfaesi_case_status_update"),
    scsd: escapeSqlTableId("sarfaesi_case_status_update_details"),
    scp: escapeSqlTableId("sarfaesi_case_particulars"),
    um: escapeSqlTableId("unit_master"),
    br: escapeSqlTableId("branch_master"),
    rbo: escapeSqlTableId("rbo_master"),
    hz: escapeSqlTableId("ho_zo_master"),
    bank: escapeSqlTableId("bank_master"),
    lvm: escapeSqlTableId("lookup_value_master"),
    ltm: escapeSqlTableId("lookup_type_master")
  };
}

/**
 * SQL fragment restricting to SARFAESI loan category.
 * @returns {{ sql: string, values: string[] }}
 */
export function buildSarfaesiLoanCategoryWhereSql() {
  const t = sqlTableIds();
  return {
    sql: `nci.loanCategory IN (
      SELECT lvm.id
      FROM ${t.lvm} lvm
      INNER JOIN ${t.ltm} ltm ON lvm.lookupType = ltm.id
      WHERE LOWER(TRIM(ltm.lookupType)) = LOWER(TRIM(?))
        AND LOWER(TRIM(lvm.lookupValue)) = LOWER(TRIM(?))
    )`,
    values: [SARFAESI_INVOICE_LOAN_CATEGORY_LOOKUP_TYPE, SARFAESI_INVOICE_LOAN_CATEGORY_LOOKUP_VALUE]
  };
}

/**
 * Groups detail remarks by sarfaesiUpdateId → particularsId for the custom 4-row layout.
 * @param {Array<{ sarfaesiUpdateId: number, particularsId: number, remarks: unknown }>} detailRows
 * @returns {Map<number, Record<number, string>>}
 */
export function mapSarfaesiDetailsByUpdateId(detailRows) {
  const byUpdateId = new Map();
  for (const row of detailRows || []) {
    const updateId = Number(row.sarfaesiUpdateId);
    const particularsId = Number(row.particularsId);
    if (!Number.isFinite(updateId) || !Number.isFinite(particularsId)) continue;
    if (!byUpdateId.has(updateId)) byUpdateId.set(updateId, {});
    byUpdateId.get(updateId)[particularsId] = row.remarks != null ? String(row.remarks) : "";
  }
  return byUpdateId;
}

/** Loads active SARFAESI particulars master rows ordered by sequence. */
async function loadActiveParticulars() {
  const t = sqlTableIds();
  const [rows] = await pool.query(
    `SELECT id, particulars AS label, sequence
     FROM ${t.scp}
     WHERE LOWER(TRIM(COALESCE(active, ''))) = 'yes'
     ORDER BY sequence ASC, id ASC`
  );
  return (rows || []).map((r) => ({
    id: Number(r.id),
    label: String(r.label ?? ""),
    sequence: Number(r.sequence) || 0
  }));
}

/** SELECT open SARFAESI cases that have a status-update record. */
function buildSelectSql() {
  const t = sqlTableIds();
  const recovered = amountRecoveredSubquerySql();
  const branchLabel = branchLabelSelectSql("br", "bank");
  return `
  SELECT
    scsu.id AS sarfaesiUpdateId,
    nci.entrustmentDate AS entrustmentDate,
    nci.caseNo AS caseNo,
    nci.borrower AS borrower,
    nci.loanAccountNo AS loanAccountNo,
    nci.closureBalance AS closureBalance,
    nci.caseStatusRemarks AS caseStatusRemarks,
    ${branchLabel},
    lt.lookupValue AS loanTypeLabel,
    ns.lookupValue AS npaStatusLabel,
    nci.npaDate AS npaDate,
    ${recovered} AS amountRecovered
  FROM ${t.nci} nci
  INNER JOIN ${t.scsu} scsu ON scsu.caseNo = nci.id
  INNER JOIN ${t.um} um ON um.id = nci.unit
  INNER JOIN ${t.br} br ON br.id = nci.branch
  INNER JOIN ${t.rbo} rbo ON rbo.id = br.rbo_ro
  INNER JOIN ${t.hz} hz ON hz.id = rbo.ho_zo
  INNER JOIN ${t.bank} bank ON bank.id = hz.bank
  INNER JOIN ${t.lvm} lt ON lt.id = nci.loanType
  LEFT JOIN ${t.lvm} ns ON ns.id = nci.npaStatus
  LEFT JOIN ${t.lvm} cs ON cs.id = nci.caseStatus
`;
}

/**
 * As-on-date + SARFAESI loan category + open status + optional dimension filters.
 * @param {Record<string, unknown>} filters
 */
function buildWhere(filters) {
  const parts = [];
  const values = [];

  const asOn = toYyyyMmDdForSqlDateField(filters.asOnDate);
  parts.push("nci.entrustmentDate <= ?");
  values.push(asOn);

  const sarfaesiLoan = buildSarfaesiLoanCategoryWhereSql();
  parts.push(sarfaesiLoan.sql);
  values.push(...sarfaesiLoan.values);

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

/** Loads particulars remarks for the given SARFAESI status-update ids. */
async function loadDetailsForUpdates(updateIds) {
  if (!updateIds.length) return new Map();
  const t = sqlTableIds();
  const placeholders = updateIds.map(() => "?").join(", ");
  const [rows] = await pool.query(
    `SELECT d.sarfaesiUpdateId, d.particulars AS particularsId, d.remarks
     FROM ${t.scsd} d
     WHERE d.sarfaesiUpdateId IN (${placeholders})`,
    updateIds
  );
  return mapSarfaesiDetailsByUpdateId(
    (rows || []).map((r) => ({
      sarfaesiUpdateId: r.sarfaesiUpdateId,
      particularsId: r.particularsId,
      remarks: r.remarks
    }))
  );
}

/**
 * Runs SARFAESI Case Report (custom 4-row-per-case layout) as of the selected date.
 * @param {object} user
 * @param {Record<string, unknown>} filters
 * @param {{ limit?: number }} ctx
 */
export async function runReport(user, filters, ctx = {}) {
  const { whereSql, values } = buildWhere(filters);
  const limit = Math.min(Math.max(Number(ctx.limit) || 50000, 1), 50000);
  const asOnDate = toYyyyMmDdForSqlDateField(filters.asOnDate);

  const [particulars, caseResult] = await Promise.all([
    loadActiveParticulars(),
    pool.query(
      `${buildSelectSql()} WHERE ${whereSql} ORDER BY nci.entrustmentDate ASC, nci.caseNo ASC LIMIT ?`,
      [...values, limit]
    )
  ]);

  const rawRows = caseResult[0] || [];
  const updateIds = rawRows.map((r) => Number(r.sarfaesiUpdateId)).filter((id) => Number.isFinite(id));
  const detailsByUpdateId = await loadDetailsForUpdates(updateIds);

  const cases = rawRows.map((r, idx) => {
    const updateId = Number(r.sarfaesiUpdateId);
    const particularsById = detailsByUpdateId.get(updateId) || {};
    return {
      slNo: idx + 1,
      sarfaesiUpdateId: updateId,
      caseNo: r.caseNo ?? "",
      branchLabel: r.branchLabel ?? "",
      borrower: r.borrower ?? "",
      loanAccountNo: r.loanAccountNo != null ? String(r.loanAccountNo) : "",
      loanTypeLabel: r.loanTypeLabel ?? "",
      npaDate: r.npaDate,
      npaStatusLabel: r.npaStatusLabel ?? "",
      entrustmentDate: r.entrustmentDate,
      closureBalance: r.closureBalance,
      amountRecovered: r.amountRecovered,
      caseStatusRemarks: r.caseStatusRemarks ?? "",
      particularsById
    };
  });

  return {
    layout: "custom",
    truncated: rawRows.length >= limit,
    custom: {
      asOnDate,
      primaryFieldCount: PRIMARY_FIELD_COUNT,
      particulars,
      cases
    }
  };
}

