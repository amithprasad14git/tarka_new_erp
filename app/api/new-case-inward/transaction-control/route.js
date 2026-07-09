/**
 * HTTP handler for `/api/new-case-inward/transaction-control`.
 * Business rules live in lib/modules; this file loads data and returns JSON or files.
 */

// Application route/page/API handler for this feature area.
// Keep module-specific business logic in lib/modules/<module> files.

import { cookies } from "next/headers";
import pool from "../../../../lib/db";
import { modules } from "../../../../config/modules";
import { getSessionUser } from "../../../../lib/session";
import { escapeSqlTableIdForModuleConfig } from "../../../../lib/sqlModuleTable";
import { jsonApiErrorForAction, jsonUnauthorizedForSession } from "../../../../lib/apiErrorResponse";

/**
 * Returns New Case Inward transaction-control rows for UI date-picker limits.
 * Auth-only endpoint: no module-level RBAC gate, so non-admin users can still
 * receive min-date hints needed to enforce picker boundaries.
 */
// Active date-control rules so NCI date fields respect allow/days settings.
export async function GET() {
  try {
    // Auth check only: this endpoint feeds date-picker limits to logged-in users.
    const cookieStore = await cookies();
    const sid = cookieStore.get("session")?.value;
    const user = await getSessionUser(sid);
    if (!user) return await jsonUnauthorizedForSession(sid);

    const cfg = modules.new_case_inward_transaction_control;
    // If module config is missing, return empty data instead of failing hard.
    if (!cfg?.table) return Response.json({ data: [] });
    const t = escapeSqlTableIdForModuleConfig(cfg);

    // Keep payload minimal and deterministic for date-picker logic.
    const [rows] = await pool.query(
      `
      SELECT id, field_name, allow_flag, days
      FROM ${t}
      -- Only active controls should affect UI restrictions.
      WHERE is_active = 1
      ORDER BY id DESC
      `
    );

    return Response.json({ data: Array.isArray(rows) ? rows : [] });
  } catch (error) {
    return jsonApiErrorForAction(error, "loadTransactionControl", { logLabel: "NCI transaction control API" });
  }
}

