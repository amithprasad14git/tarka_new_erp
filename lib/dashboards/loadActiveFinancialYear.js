// Shared dashboard helper — active financial year for FY-scoped KPI widgets.

/**
 * Finds the financial year used by recovery, invoice, and regional dashboards.
 * Prefers the FY containing today; falls back to latest active FY row.
 */

import pool from "../db";
import { escapeSqlTableId } from "../sqlModuleTable";
import { formatFinancialYearRangeLabel } from "../reports/formatFinancialYearRange";

/**
 * Loads the FY row used to bound dashboard SQL (today inside range, else latest active).
 * @returns {Promise<{ id: number, yearCode: string, startDate: string, endDate: string, yearRangeLabel: string } | null>}
 */
export async function loadActiveFinancialYear() {
  const t = escapeSqlTableId("financial_year_master");

  // Prefer FY where today falls between start and end.
  const [currentRows] = await pool.query(
    `SELECT id, yearCode, startDate, endDate
     FROM ${t}
     WHERE active = 'Yes'
       AND startDate <= CURDATE()
       AND endDate >= CURDATE()
     ORDER BY startDate DESC
     LIMIT 1`
  );

  let row = currentRows?.[0];
  if (!row) {
    // No current FY (e.g. gap between years) — use most recent active row.
    const [fallbackRows] = await pool.query(
      `SELECT id, yearCode, startDate, endDate
       FROM ${t}
       WHERE active = 'Yes'
       ORDER BY startDate DESC
       LIMIT 1`
    );
    row = fallbackRows?.[0];
  }

  if (!row) return null;

  return {
    id: row.id,
    yearCode: String(row.yearCode ?? ""),
    startDate: row.startDate,
    endDate: row.endDate,
    yearRangeLabel: formatFinancialYearRangeLabel(row.startDate, row.endDate)
  };
}
