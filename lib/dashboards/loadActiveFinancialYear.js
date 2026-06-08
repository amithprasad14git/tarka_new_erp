// Shared dashboard helper — resolve active financial year for KPI widgets.

/**
 * Loads the current financial year for dashboard aggregation.
 * Prefers active FY where today falls between startDate and endDate;
 * falls back to the latest active FY row.
 */

import pool from "../db";
import { escapeSqlTableId } from "../sqlModuleTable";
import { formatFinancialYearRangeLabel } from "../reports/formatFinancialYearRange";

/**
 * @returns {Promise<{ id: number, yearCode: string, startDate: string, endDate: string, yearRangeLabel: string } | null>}
 */
export async function loadActiveFinancialYear() {
  const t = escapeSqlTableId("financial_year_master");

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
