// Report — Region Wise Cummulative (custom layout).

/**
 * Region Wise Cummulative Report — SQL and grouping for bespoke table layout.
 * Settled cases (final statuses except Returned) in selected FY with cash recovered > 0.
 * Groups by RBO region × loan category; returns custom payload for ReportCustomOutputView.
 * Excel: re-exports buildCustomWorkbook from lib/reports/custom/.../buildCustomWorkbook.js.
 * Config: config/reports.js → report_region_wise_cumulative_report. See docs/REPORTS.md.
 */

import pool from "../db";
import { appendNciUnitFilterIfSelected } from "./nciReportDimensionFilters.js";
import { escapeSqlTableId } from "../sqlModuleTable";
import { toYyyyMmDdForSqlDateField } from "../sqlDateFieldValue";
import { buildSettledCaseStatusWhereSql } from "./report_settled_cases.js";
import { groupRegionWiseCumulativeRows } from "./groupRegionWiseCumulativeRows.js";
import { loadFinancialYearById } from "./loadFinancialYearById.js";

export { buildCustomWorkbook } from "./custom/report_region_wise_cumulative_report/buildCustomWorkbook.js";

function sqlTableIds() {
  return {
    nci: escapeSqlTableId("new_case_inward"),
    ar: escapeSqlTableId("new_case_inward_amount_recovered"),
    br: escapeSqlTableId("branch_master"),
    rbo: escapeSqlTableId("rbo_master"),
    hz: escapeSqlTableId("ho_zo_master"),
    bank: escapeSqlTableId("bank_master"),
    lvm: escapeSqlTableId("lookup_value_master")
  };
}

/** Inner query per case; outer aggregates by RBO + loan category. */
function buildAggregatedSql() {
  const t = sqlTableIds();
  return `
SELECT
  b.rbo_ro_id,
  b.rbo_ro,
  b.loan_category_id,
  b.loan_category,
  SUM(b.no_of_cases) AS no_of_cases,
  SUM(b.amount_recovered) AS amount_recovered,
  SUM(b.npa_reduced) AS npa_reduced
FROM (
  SELECT
    a.rbo_ro_id,
    a.rbo_ro,
    a.loan_category_id,
    a.loan_category,
    a.no_of_cases,
    a.amount_recovered,
    a.closureBalance AS npa_reduced
  FROM (
    SELECT
      nci.id AS case_inward_id,
      1 AS no_of_cases,
      rbo.id AS rbo_ro_id,
      rbo.shortCode AS rbo_ro,
      lc.id AS loan_category_id,
      lc.lookupValue AS loan_category,
      (SELECT COALESCE(SUM(ar.recoveredAmount), 0)
       FROM ${t.ar} ar
       WHERE ar.caseInwardId = nci.id) AS amount_recovered,
      nci.closureBalance
    FROM ${t.nci} nci
    INNER JOIN ${t.lvm} lc ON lc.id = nci.loanCategory
    INNER JOIN ${t.br} br ON br.id = nci.branch
    INNER JOIN ${t.rbo} rbo ON rbo.id = br.rbo_ro
    INNER JOIN ${t.hz} hz ON hz.id = rbo.ho_zo
    INNER JOIN ${t.bank} bank ON bank.id = hz.bank
    LEFT JOIN ${t.lvm} cs ON cs.id = nci.caseStatus
    WHERE /*INNER_WHERE*/
  ) a
  WHERE a.amount_recovered > 0
) b
GROUP BY b.rbo_ro_id, b.loan_category_id
ORDER BY b.rbo_ro, b.loan_category
`;
}

/**
 * @param {Record<string, unknown>} filters
 * @param {string} fyStart
 * @param {string} fyEnd
 */
function buildFilterParts(filters, fyStart, fyEnd) {
  // FY window on case status update date (not entrustment date).
  const parts = ["nci.caseStatusUpdatedDate >= ?", "nci.caseStatusUpdatedDate <= ?"];
  const values = [fyStart, fyEnd];

  // Settled / final statuses — same rule as Settled Cases report, excluding Returned.
  const settled = buildSettledCaseStatusWhereSql();
  parts.push(settled.sql);
  values.push(...settled.values);

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

  return { whereSql: parts.join(" AND "), values };
}

/**
 * @param {object} user
 * @param {Record<string, unknown>} filters
 * @param {{ limit?: number }} ctx
 */
export async function runReport(user, filters, ctx = {}) {
  void ctx;

  const financialYear = await loadFinancialYearById(filters.financialYear);
  if (!financialYear) {
    throw new Error("Invalid Financial Year");
  }

  const fyStart = toYyyyMmDdForSqlDateField(financialYear.startDate);
  const fyEnd = toYyyyMmDdForSqlDateField(financialYear.endDate);

  const { whereSql, values } = buildFilterParts(filters, fyStart, fyEnd);
  const sql = buildAggregatedSql().replace("/*INNER_WHERE*/", whereSql);

  const [rawRows] = await pool.query(sql, values);
  const { sections, grandTotal } = groupRegionWiseCumulativeRows(rawRows);

  return {
    layout: "custom",
    custom: {
      financialYear,
      sections,
      grandTotal
    },
    truncated: false
  };
}
