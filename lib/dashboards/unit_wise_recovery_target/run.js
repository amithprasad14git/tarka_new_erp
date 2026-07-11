// Dashboard — Unit Wise Recovery Target (runtime SQL aggregation).

/**
 * Achieved recovery = lifetime cash recovered on cases settled in active FY
 * (same rules as Unit Wise Cumulative report: final status except Returned,
 * caseStatusUpdatedDate in FY, amount_recovered > 0). Scoped to user unit(s).
 * Bank pie, settled-case KPI, and month-wise chart by settlement month.
 * Guide: README.md#5a-landing-dashboards
 */

import pool from "../../db";
import { escapeSqlTableId } from "../../sqlModuleTable";
import { toYyyyMmDdForSqlDateField } from "../../sqlDateFieldValue";
import { loadActiveFinancialYear } from "../loadActiveFinancialYear.js";
import { buildSettledCaseStatusWhereSql } from "../../reports/report_settled_cases.js";
import { buildOpenCaseStatusWhereSql } from "../../reports/report_pending_cases_on_hand.js";
import { buildAmountRecoveredGtZeroWhereSql } from "../../reports/report_part_recovered_cases.js";

/** Safe quoted table names for recovery target SQL. */
function sqlTableIds() {
  return {
    um: escapeSqlTableId("unit_master"),
    nci: escapeSqlTableId("new_case_inward"),
    ar: escapeSqlTableId("new_case_inward_amount_recovered"),
    br: escapeSqlTableId("branch_master"),
    rbo: escapeSqlTableId("rbo_master"),
    hz: escapeSqlTableId("ho_zo_master"),
    bank: escapeSqlTableId("bank_master"),
    lvm: escapeSqlTableId("lookup_value_master")
  };
}

/**
 * Percentage of recovery target achieved (0–100), capped for donut and bank rows.
 * @param {number} amountRecovered
 * @param {number} recoveryTarget
 * @returns {number}
 */
function computeAchievedPct(amountRecovered, recoveryTarget) {
  const target = Number(recoveryTarget);
  const recovered = Number(amountRecovered);
  if (!Number.isFinite(target) || target <= 0) return 0;
  if (!Number.isFinite(recovered) || recovered <= 0) return 0;
  return Math.max(0, Math.min(100, (recovered / target) * 100));
}

/** Builds `?, ?, ?` placeholders for IN (unitIds). */
function unitInClause(unitCount) {
  return unitCount > 0 ? Array(unitCount).fill("?").join(", ") : "?";
}

/**
 * Inner query: one row per case settled in FY with lifetime recovery and bank label.
 * @param {number} unitCount
 * @returns {{ innerSql: string, settledValues: string[] }}
 */
function buildSettledCasesInnerSql(unitCount) {
  const t = sqlTableIds();
  const placeholders = unitInClause(unitCount);
  const settled = buildSettledCaseStatusWhereSql();

  const innerSql = `
SELECT
  nci.id AS case_inward_id,
  1 AS no_of_cases,
  bank.id AS bankId,
  CONCAT(bank.bankCode, ' - ', bank.bankName) AS bankLabel,
  DATE_FORMAT(nci.caseStatusUpdatedDate, '%Y-%m') AS monthKey,
  CONCAT(DATE_FORMAT(nci.caseStatusUpdatedDate, '%b'), '-', DATE_FORMAT(nci.caseStatusUpdatedDate, '%Y')) AS monthLabel,
  (SELECT COALESCE(SUM(ar.recoveredAmount), 0)
   FROM ${t.ar} ar
   WHERE ar.caseInwardId = nci.id) AS amount_recovered
FROM ${t.nci} nci
INNER JOIN ${t.br} br ON br.id = nci.branch
INNER JOIN ${t.rbo} rbo ON rbo.id = br.rbo_ro
INNER JOIN ${t.hz} hz ON hz.id = rbo.ho_zo
INNER JOIN ${t.bank} bank ON bank.id = hz.bank
LEFT JOIN ${t.lvm} cs ON cs.id = nci.caseStatus
WHERE nci.unit IN (${placeholders})
  AND nci.caseStatusUpdatedDate >= ?
  AND nci.caseStatusUpdatedDate <= ?
  AND ${settled.sql}`;

  return { innerSql, settledValues: settled.values };
}

/** Settled cases in FY with lifetime cash recovered > 0 (Unit Wise Cumulative rules). */
export function buildSettledCasesSubquerySql(unitCount) {
  const { innerSql } = buildSettledCasesInnerSql(unitCount);
  return `SELECT * FROM (${innerSql}) settled WHERE settled.amount_recovered > 0`;
}

/**
 * Bind values for settled-case subquery queries (unit ids, FY bounds, status labels).
 * @param {number} unitCount
 * @param {string} fyStart
 * @param {string} fyEnd
 * @param {number[]} unitIds
 * @returns {Array<string | number>}
 */
export function settledCasesQueryBindValues(unitCount, fyStart, fyEnd, unitIds) {
  const { settledValues } = buildSettledCasesInnerSql(unitCount);
  return [...unitIds, fyStart, fyEnd, ...settledValues];
}

/**
 * Which units this user may see on the recovery target dashboard (admin = all active).
 * @param {object} user
 * @returns {Promise<{ unitIds: number[], message?: string }>}
 */
async function resolveUnitScope(user) {
  const t = sqlTableIds().um;

  if (user && Number(user.role) === 1) {
    const [rows] = await pool.query(
      `SELECT id FROM ${t} WHERE active = 'Yes' ORDER BY unitCode`
    );
    const unitIds = (rows || []).map((r) => Number(r.id)).filter(Number.isFinite);
    return { unitIds };
  }

  const uid = user?.unit != null && user.unit !== "" ? Number(user.unit) : null;
  if (!Number.isFinite(uid)) {
    return {
      unitIds: [],
      message: "Your account is not assigned to a unit. Contact administrator."
    };
  }

  const [rows] = await pool.query(
    `SELECT id FROM ${t} WHERE id = ? AND active = 'Yes' LIMIT 1`,
    [uid]
  );
  if (!rows?.length) {
    return {
      unitIds: [],
      message: "Your assigned unit is inactive or not found. Contact administrator."
    };
  }

  return { unitIds: [uid] };
}

/** Sum of unit_master.recoveryTarget for scoped units — FY target amount. */
export function buildUnitRecoveryTargetSql(unitCount) {
  const t = sqlTableIds();
  const placeholders = unitInClause(unitCount);
  return `
SELECT COALESCE(SUM(um.recoveryTarget), 0) AS recoveryTarget
FROM ${t.um} um
WHERE um.id IN (${placeholders})
  AND um.active = 'Yes'
`;
}

/** Settled-in-FY cash recovered grouped by bank — feeds bank pie and donut totals. */
export function buildBankWiseRecoveryAggregationSql(unitCount) {
  const base = buildSettledCasesSubquerySql(unitCount);
  return `
SELECT
  x.bankId,
  x.bankLabel,
  COALESCE(SUM(x.amount_recovered), 0) AS amountRecovered
FROM (${base}) x
GROUP BY x.bankId, x.bankLabel
HAVING amountRecovered > 0
ORDER BY x.bankLabel
`;
}

/** Settled cases in active FY with lifetime cash recovered > 0. */
export function buildRecoveredCaseCountSql(unitCount) {
  const base = buildSettledCasesSubquerySql(unitCount);
  return `
SELECT COALESCE(SUM(x.no_of_cases), 0) AS recoveredCaseCount
FROM (${base}) x
`;
}

/** Open cases with some recovery but not fully settled — part-recovered KPI. */
export function buildPartRecoveredCaseCountSql(unitCount) {
  const t = sqlTableIds();
  const placeholders = unitInClause(unitCount);
  const openCase = buildOpenCaseStatusWhereSql();
  const recoveredGtZero = buildAmountRecoveredGtZeroWhereSql();
  return `
SELECT COUNT(DISTINCT nci.id) AS partRecoveredCaseCount
FROM ${t.nci} nci
LEFT JOIN ${t.lvm} cs ON cs.id = nci.caseStatus
WHERE nci.unit IN (${placeholders})
  AND ${openCase.sql}
  AND ${recoveredGtZero.sql}
`;
}

/** Binds open-case status values for part-recovered count query. */
export function partRecoveredCaseCountBindValues(unitCount) {
  const openCase = buildOpenCaseStatusWhereSql();
  return { sql: buildPartRecoveredCaseCountSql(unitCount), extraValues: [...openCase.values] };
}

/** FY achieved amount by settlement month (caseStatusUpdatedDate) — panel 4 column chart. */
export function buildMonthWiseRecoverySql(unitCount) {
  const base = buildSettledCasesSubquerySql(unitCount);
  return `
SELECT
  x.monthKey,
  x.monthLabel,
  COALESCE(SUM(x.amount_recovered), 0) AS amountRecovered
FROM (${base}) x
GROUP BY x.monthKey, x.monthLabel
ORDER BY x.monthKey
`;
}

/** Open cases on hand grouped by case status — KPI strip grid (no/blank status → For Execution). */
export function buildPendingCaseStatusCountSql(unitCount) {
  const t = sqlTableIds();
  const placeholders = unitInClause(unitCount);
  const openCase = buildOpenCaseStatusWhereSql();
  return `
SELECT
  CASE
    WHEN nci.caseStatus IS NULL
      OR cs.lookupValue IS NULL
      OR TRIM(cs.lookupValue) = ''
    THEN 'For Execution'
    ELSE TRIM(cs.lookupValue)
  END AS statusLabel,
  COUNT(DISTINCT nci.id) AS caseCount
FROM ${t.nci} nci
LEFT JOIN ${t.lvm} cs ON cs.id = nci.caseStatus
WHERE nci.unit IN (${placeholders})
  AND DATE(nci.entrustmentDate) <= CURDATE()
  AND ${openCase.sql}
GROUP BY statusLabel
ORDER BY caseCount DESC
`;
}

/** Binds open-case status values for pending-on-hand count query. */
export function pendingCaseStatusCountBindValues(unitCount) {
  const openCase = buildOpenCaseStatusWhereSql();
  return { sql: buildPendingCaseStatusCountSql(unitCount), extraValues: [...openCase.values] };
}

/** @deprecated Use buildPendingCaseStatusCountSql */
export function buildCaseStatusCountSql(unitCount) {
  return buildPendingCaseStatusCountSql(unitCount);
}

/** @deprecated Use buildBankWiseRecoveryAggregationSql */
export function buildRecoveryAggregationSql(unitCount) {
  return buildBankWiseRecoveryAggregationSql(unitCount);
}

/** Empty widget shape when user has no unit or no data — avoids chart errors. */
function emptyDashboardPayload(financialYear, message) {
  return {
    financialYear,
    rows: [],
    totals: { recoveryTarget: 0, amountRecovered: 0, achievedPct: 0, gapToTarget: 0 },
    kpis: { gapToTarget: 0, recoveredCaseCount: 0, partRecoveredCaseCount: 0, caseStatusCounts: [] },
    monthWiseRecovery: [],
    message
  };
}

/**
 * Server loader for GET /api/dashboard/unit_wise_recovery_target.
 * Runs parallel SQL for target, banks, KPIs, and month trend; merges totals for donut.
 * @param {object} user
 * @returns {Promise<{ ok: true, data: object } | { ok: false, error: string, status?: number }>}
 */
export async function loadDashboard(user) {
  const financialYear = await loadActiveFinancialYear();
  if (!financialYear) {
    return { ok: false, error: "No active financial year configured.", status: 400 };
  }

  const fyStart = toYyyyMmDdForSqlDateField(financialYear.startDate);
  const fyEnd = toYyyyMmDdForSqlDateField(financialYear.endDate);
  if (!fyStart || !fyEnd) {
    return { ok: false, error: "Invalid financial year date range.", status: 400 };
  }

  const { unitIds, message } = await resolveUnitScope(user);
  if (!unitIds.length) {
    return {
      ok: true,
      data: emptyDashboardPayload(financialYear, message || "No unit data available.")
    };
  }

  const settledBind = settledCasesQueryBindValues(unitIds.length, fyStart, fyEnd, unitIds);
  const partRecovered = partRecoveredCaseCountBindValues(unitIds.length);
  const pendingStatus = pendingCaseStatusCountBindValues(unitIds.length);

  const [
    [targetRows],
    [rawBankRows],
    [recoveredCaseRows],
    [partRecoveredRows],
    [monthRows],
    [statusCountRows]
  ] = await Promise.all([
    // Panel totals: unit target sum from unit_master.
    pool.query(buildUnitRecoveryTargetSql(unitIds.length), unitIds),
    // Bank pie slices: settled-in-FY recovery grouped by bank.
    pool.query(buildBankWiseRecoveryAggregationSql(unitIds.length), settledBind),
    pool.query(buildRecoveredCaseCountSql(unitIds.length), settledBind),
    pool.query(partRecovered.sql, [...unitIds, ...partRecovered.extraValues]),
    pool.query(buildMonthWiseRecoverySql(unitIds.length), settledBind),
    pool.query(pendingStatus.sql, [...unitIds, ...pendingStatus.extraValues])
  ]);

  const recoveryTarget = Number(targetRows?.[0]?.recoveryTarget) || 0;

  const rows = (rawBankRows || []).map((r) => {
    const amountRecovered = Number(r.amountRecovered) || 0;
    return {
      bankId: Number(r.bankId),
      bankLabel: String(r.bankLabel ?? ""),
      amountRecovered,
      achievedPct: computeAchievedPct(amountRecovered, recoveryTarget)
    };
  });

  const amountRecovered = rows.reduce((s, r) => s + r.amountRecovered, 0);
  const gapToTarget = Math.max(0, recoveryTarget - amountRecovered);
  const totals = {
    recoveryTarget,
    amountRecovered,
    achievedPct: computeAchievedPct(amountRecovered, recoveryTarget),
    gapToTarget
  };

  const kpis = {
    gapToTarget,
    recoveredCaseCount: Number(recoveredCaseRows?.[0]?.recoveredCaseCount) || 0,
    partRecoveredCaseCount: Number(partRecoveredRows?.[0]?.partRecoveredCaseCount) || 0,
    caseStatusCounts: (statusCountRows || []).map((r) => ({
      statusLabel: String(r.statusLabel ?? "").trim(),
      caseCount: Number(r.caseCount) || 0
    })).filter((r) => r.statusLabel)
  };

  const monthWiseRecovery = (monthRows || []).map((r) => ({
    monthKey: String(r.monthKey ?? ""),
    monthLabel: String(r.monthLabel ?? ""),
    amountRecovered: Number(r.amountRecovered) || 0
  }));

  return {
    ok: true,
    data: {
      financialYear,
      rows,
      totals,
      kpis,
      monthWiseRecovery,
      message: rows.length ? undefined : "No bank-wise recovery recorded for this period."
    }
  };
}

