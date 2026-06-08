// Dashboard — Unit Wise Recovery Target (runtime SQL aggregation).

/**
 * Achieved recovery = SUM(recoveredAmount) where recoveredDate is in active FY,
 * scoped to logged-in user's unit (or all active units for role 1 admin).
 * Bank-wise bars, KPI strip, and month-wise recovery trend.
 */

import pool from "../../db";
import { escapeSqlTableId } from "../../sqlModuleTable";
import { toYyyyMmDdForSqlDateField } from "../../sqlDateFieldValue";
import { loadActiveFinancialYear } from "../loadActiveFinancialYear.js";
import { buildOpenCaseStatusWhereSql } from "../../reports/report_pending_cases_on_hand.js";
import { buildAmountRecoveredGtZeroWhereSql } from "../../reports/report_part_recovered_cases.js";

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

function unitInClause(unitCount) {
  return unitCount > 0 ? Array(unitCount).fill("?").join(", ") : "?";
}

/**
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

/** @returns {string} */
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

/** @returns {string} */
export function buildBankWiseRecoveryAggregationSql(unitCount) {
  const t = sqlTableIds();
  const placeholders = unitInClause(unitCount);
  return `
SELECT
  bank.id AS bankId,
  CONCAT(bank.bankCode, ' - ', bank.bankName) AS bankLabel,
  COALESCE(SUM(ar.recoveredAmount), 0) AS amountRecovered
FROM ${t.nci} nci
INNER JOIN ${t.br} br ON br.id = nci.branch
INNER JOIN ${t.rbo} rbo ON rbo.id = br.rbo_ro
INNER JOIN ${t.hz} hz ON hz.id = rbo.ho_zo
INNER JOIN ${t.bank} bank ON bank.id = hz.bank
LEFT JOIN ${t.ar} ar
  ON ar.caseInwardId = nci.id
  AND DATE(ar.recoveredDate) >= ?
  AND DATE(ar.recoveredDate) <= ?
WHERE nci.unit IN (${placeholders})
  AND bank.active = 'Yes'
GROUP BY bank.id, bank.bankCode, bank.bankName
HAVING amountRecovered > 0
ORDER BY bank.bankCode
`;
}

/** @returns {string} */
export function buildRecoveredCaseCountSql(unitCount) {
  const t = sqlTableIds();
  const placeholders = unitInClause(unitCount);
  return `
SELECT COUNT(DISTINCT nci.id) AS recoveredCaseCount
FROM ${t.nci} nci
INNER JOIN ${t.ar} ar ON ar.caseInwardId = nci.id
WHERE nci.unit IN (${placeholders})
  AND DATE(ar.recoveredDate) >= ?
  AND DATE(ar.recoveredDate) <= ?
`;
}

/** @returns {string} */
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

/** @returns {{ sql: string, extraValues: unknown[] }} */
export function partRecoveredCaseCountBindValues(unitCount) {
  const openCase = buildOpenCaseStatusWhereSql();
  return { sql: buildPartRecoveredCaseCountSql(unitCount), extraValues: [...openCase.values] };
}

/** @returns {string} */
export function buildMonthWiseRecoverySql(unitCount) {
  const t = sqlTableIds();
  const placeholders = unitInClause(unitCount);
  return `
SELECT
  DATE_FORMAT(ar.recoveredDate, '%Y-%m') AS monthKey,
  CONCAT(DATE_FORMAT(ar.recoveredDate, '%b'), '-', DATE_FORMAT(ar.recoveredDate, '%Y')) AS monthLabel,
  COALESCE(SUM(ar.recoveredAmount), 0) AS amountRecovered
FROM ${t.nci} nci
INNER JOIN ${t.ar} ar ON ar.caseInwardId = nci.id
WHERE nci.unit IN (${placeholders})
  AND DATE(ar.recoveredDate) >= ?
  AND DATE(ar.recoveredDate) <= ?
GROUP BY monthKey, monthLabel
ORDER BY monthKey
`;
}

/** @returns {string} */
export function buildPendingCaseStatusCountSql(unitCount) {
  const t = sqlTableIds();
  const placeholders = unitInClause(unitCount);
  const openCase = buildOpenCaseStatusWhereSql();
  return `
SELECT
  TRIM(cs.lookupValue) AS statusLabel,
  COUNT(DISTINCT nci.id) AS caseCount
FROM ${t.nci} nci
INNER JOIN ${t.lvm} cs ON cs.id = nci.caseStatus
WHERE nci.unit IN (${placeholders})
  AND DATE(nci.entrustmentDate) <= CURDATE()
  AND ${openCase.sql}
  AND TRIM(cs.lookupValue) <> ''
GROUP BY statusLabel
ORDER BY caseCount DESC
`;
}

/** @returns {{ sql: string, extraValues: unknown[] }} */
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

  const fyDateValues = [fyStart, fyEnd];
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
    pool.query(buildUnitRecoveryTargetSql(unitIds.length), unitIds),
    pool.query(buildBankWiseRecoveryAggregationSql(unitIds.length), [...fyDateValues, ...unitIds]),
    pool.query(buildRecoveredCaseCountSql(unitIds.length), [...unitIds, ...fyDateValues]),
    pool.query(partRecovered.sql, [...unitIds, ...partRecovered.extraValues]),
    pool.query(buildMonthWiseRecoverySql(unitIds.length), [...unitIds, ...fyDateValues]),
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
