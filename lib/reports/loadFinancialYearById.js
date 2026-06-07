// Shared report helper — load financial year for report filters.

/**
 * Loads one financial_year_master row for mandatory FY filter on Region Wise Cummulative Report.
 * Returns yearCode and a display label "YYYY - YYYY" for headers.
 */

import pool from "../db";
import { escapeSqlTableId } from "../sqlModuleTable";
import { formatFinancialYearRangeLabel } from "./formatFinancialYearRange";

/**
 * @param {unknown} financialYearId
 * @returns {Promise<{ id: number, yearCode: string, startDate: string, endDate: string, yearRangeLabel: string } | null>}
 */
export async function loadFinancialYearById(financialYearId) {
  const id = Number(financialYearId);
  if (!Number.isFinite(id)) return null;

  const t = escapeSqlTableId("financial_year_master");
  const [rows] = await pool.query(
    `SELECT id, yearCode, startDate, endDate FROM ${t} WHERE id = ? LIMIT 1`,
    [id]
  );
  const row = rows?.[0];
  if (!row) return null;

  return {
    id: row.id,
    yearCode: String(row.yearCode ?? ""),
    startDate: row.startDate,
    endDate: row.endDate,
    yearRangeLabel: formatFinancialYearRangeLabel(row.startDate, row.endDate)
  };
}
