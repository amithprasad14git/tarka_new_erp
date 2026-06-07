// Report — Unit Wise Cummulative (custom layout).

/**
 * Unit Wise Cummulative Report — SQL and grouping for bespoke table layout.
 * Settled cases (final statuses except Returned) in selected FY with cash recovered > 0.
 * Data Type: Month Wise (banded month × unit) or Summary (flat one row per unit).
 * Excel: lib/reports/custom/report_unit_wise_cumulative_report/buildCustomWorkbook.js
 * Config: config/reports.js → report_unit_wise_cumulative_report. See docs/REPORTS.md.
 */

import mysql from "mysql2";
import pool from "../db";
import { getScopeForAction } from "../rbac";
import { normalizeDataScope } from "../rowScope";
import { escapeSqlTableId } from "../sqlModuleTable";
import { toYyyyMmDdForSqlDateField } from "../sqlDateFieldValue";
import { buildSettledCaseStatusWhereSql } from "./report_settled_cases.js";
import { groupCumulativeReportRows, sumCumulativeMetrics } from "./groupCumulativeReportRows.js";
import { loadFinancialYearById } from "./loadFinancialYearById.js";

export { buildCustomWorkbook } from "./custom/report_unit_wise_cumulative_report/buildCustomWorkbook.js";

const REPORT_KEY = "report_unit_wise_cumulative_report";

function sqlTableIds() {
  return {
    nci: escapeSqlTableId("new_case_inward"),
    ar: escapeSqlTableId("new_case_inward_amount_recovered"),
    br: escapeSqlTableId("branch_master"),
    rbo: escapeSqlTableId("rbo_master"),
    hz: escapeSqlTableId("ho_zo_master"),
    bank: escapeSqlTableId("bank_master"),
    um: escapeSqlTableId("unit_master"),
    lvm: escapeSqlTableId("lookup_value_master")
  };
}

function buildMonthWiseAggregatedSql() {
  const t = sqlTableIds();
  return `
SELECT
  b.month_key,
  b.month_label,
  b.unit_id,
  b.unit_label,
  SUM(b.no_of_cases) AS no_of_cases,
  SUM(b.amount_recovered) AS amount_recovered,
  SUM(b.npa_reduced) AS npa_reduced
FROM (
  SELECT
    a.month_key,
    a.month_label,
    a.unit_id,
    a.unit_label,
    a.no_of_cases,
    a.amount_recovered,
    a.closureBalance AS npa_reduced
  FROM (
    SELECT
      nci.id AS case_inward_id,
      1 AS no_of_cases,
      DATE_FORMAT(nci.caseStatusUpdatedDate, '%Y-%m') AS month_key,
      CONCAT(DATE_FORMAT(nci.caseStatusUpdatedDate, '%M'), '-', DATE_FORMAT(nci.caseStatusUpdatedDate, '%Y')) AS month_label,
      um.id AS unit_id,
      CONCAT(um.unitCode, ' - ', um.personIncharge) AS unit_label,
      (SELECT COALESCE(SUM(ar.recoveredAmount), 0)
       FROM ${t.ar} ar
       WHERE ar.caseInwardId = nci.id) AS amount_recovered,
      nci.closureBalance
    FROM ${t.nci} nci
    INNER JOIN ${t.um} um ON um.id = nci.unit
    INNER JOIN ${t.br} br ON br.id = nci.branch
    INNER JOIN ${t.rbo} rbo ON rbo.id = br.rbo_ro
    INNER JOIN ${t.hz} hz ON hz.id = rbo.ho_zo
    INNER JOIN ${t.bank} bank ON bank.id = hz.bank
    LEFT JOIN ${t.lvm} cs ON cs.id = nci.caseStatus
    WHERE /*INNER_WHERE*/
  ) a
  WHERE a.amount_recovered > 0
) b
GROUP BY b.month_key, b.month_label, b.unit_id, b.unit_label
ORDER BY b.month_key, b.unit_label
`;
}

function buildSummaryAggregatedSql() {
  const t = sqlTableIds();
  return `
SELECT
  b.unit_id,
  b.unit_label,
  SUM(b.no_of_cases) AS no_of_cases,
  SUM(b.amount_recovered) AS amount_recovered,
  SUM(b.npa_reduced) AS npa_reduced
FROM (
  SELECT
    a.unit_id,
    a.unit_label,
    a.no_of_cases,
    a.amount_recovered,
    a.closureBalance AS npa_reduced
  FROM (
    SELECT
      nci.id AS case_inward_id,
      1 AS no_of_cases,
      um.id AS unit_id,
      CONCAT(um.unitCode, ' - ', um.personIncharge) AS unit_label,
      (SELECT COALESCE(SUM(ar.recoveredAmount), 0)
       FROM ${t.ar} ar
       WHERE ar.caseInwardId = nci.id) AS amount_recovered,
      nci.closureBalance
    FROM ${t.nci} nci
    INNER JOIN ${t.um} um ON um.id = nci.unit
    INNER JOIN ${t.br} br ON br.id = nci.branch
    INNER JOIN ${t.rbo} rbo ON rbo.id = br.rbo_ro
    INNER JOIN ${t.hz} hz ON hz.id = rbo.ho_zo
    INNER JOIN ${t.bank} bank ON bank.id = hz.bank
    LEFT JOIN ${t.lvm} cs ON cs.id = nci.caseStatus
    WHERE /*INNER_WHERE*/
  ) a
  WHERE a.amount_recovered > 0
) b
GROUP BY b.unit_id, b.unit_label
ORDER BY b.unit_label
`;
}

/**
 * @param {object} user
 * @param {Record<string, unknown>} filters
 * @param {string} fyStart
 * @param {string} fyEnd
 */
async function buildFilterParts(user, filters, fyStart, fyEnd) {
  const parts = ["nci.caseStatusUpdatedDate >= ?", "nci.caseStatusUpdatedDate <= ?"];
  const values = [fyStart, fyEnd];

  const settled = buildSettledCaseStatusWhereSql();
  parts.push(settled.sql);
  values.push(...settled.values);

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

  await appendNciRowScope(user, parts, values);

  return { whereSql: parts.join(" AND "), values };
}

/** RBAC row scope on new_case_inward (own / unit / all). */
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

function mapSummaryRows(rawRows) {
  return (rawRows || []).map((r) => ({
    unitId: r.unit_id,
    unitLabel: String(r.unit_label ?? ""),
    caseCount: Number(r.no_of_cases) || 0,
    cashRecovered: Number(r.amount_recovered) || 0,
    npaReduced: Number(r.npa_reduced) || 0
  }));
}

/**
 * @param {object} user
 * @param {Record<string, unknown>} filters
 * @param {{ limit?: number }} ctx
 */
export async function runReport(user, filters, ctx = {}) {
  void ctx;

  const dataType = String(filters.dataType || "Month Wise");
  const financialYear = await loadFinancialYearById(filters.financialYear);
  if (!financialYear) {
    throw new Error("Invalid Financial Year");
  }

  const fyStart = toYyyyMmDdForSqlDateField(financialYear.startDate);
  const fyEnd = toYyyyMmDdForSqlDateField(financialYear.endDate);

  const { whereSql, values } = await buildFilterParts(user, filters, fyStart, fyEnd);

  if (dataType === "Summary") {
    const sql = buildSummaryAggregatedSql().replace("/*INNER_WHERE*/", whereSql);
    const [rawRows] = await pool.query(sql, values);
    const rows = mapSummaryRows(rawRows);
    const totals = sumCumulativeMetrics(rows);

    return {
      layout: "custom",
      custom: {
        dataType,
        financialYear,
        rows,
        totals
      },
      truncated: false
    };
  }

  const sql = buildMonthWiseAggregatedSql().replace("/*INNER_WHERE*/", whereSql);
  const [rawRows] = await pool.query(sql, values);
  const { sections, grandTotal } = groupCumulativeReportRows(rawRows, {
    sectionIdKey: "month_key",
    sectionLabelKey: "month_label",
    detailLabelKey: "unit_label"
  });

  return {
    layout: "custom",
    custom: {
      dataType,
      financialYear,
      sections,
      grandTotal
    },
    truncated: false
  };
}
