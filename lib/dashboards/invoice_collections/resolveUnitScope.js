// Dashboard — shared unit scope for FY KPI widgets (Invoice Collections, Regional Performance).

/**
 * Decides which unit_master rows a dashboard may aggregate.
 * - Admin (role 1): all active units
 * - Unit operator: only user.unit
 * - No unit assigned: empty scope + friendly message
 */

import pool from "../../db";
import { escapeSqlTableId } from "../../sqlModuleTable";

function sqlTableIds() {
  return {
    um: escapeSqlTableId("unit_master")
  };
}

/**
 * Resolves which units to include in FY invoice/regional aggregates for this user.
 * @param {object} user
 * @returns {Promise<{ unitIds: number[], message?: string }>}
 */
export async function resolveUnitScope(user) {
  const t = sqlTableIds().um;

  // Administrators see company-wide totals across every active unit.
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
