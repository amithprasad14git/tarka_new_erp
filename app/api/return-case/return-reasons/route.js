/**
 * GET /api/return-case/return-reasons
 * Returns active case return reasons for Return Case details grid preload.
 * Authorized via return_case access — users need not have case_return_reasons module permission.
 */

import { cookies } from "next/headers";
import pool from "../../../../lib/db";
import { hasModulePermission } from "../../../../lib/rbac";
import { getSessionUser } from "../../../../lib/session";
import { loadActiveReturnReasonsForPreload } from "../../../../lib/modules/returnCase";
import { jsonApiErrorForAction, jsonUnauthorizedForSession } from "../../../../lib/apiErrorResponse";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get("session")?.value;
    const user = await getSessionUser(sid);
    if (!user) return await jsonUnauthorizedForSession(sid);

    const moduleKey = "return_case";
    const [canView, canCreate, canEdit] = await Promise.all([
      hasModulePermission(user, moduleKey, "view"),
      hasModulePermission(user, moduleKey, "create"),
      hasModulePermission(user, moduleKey, "edit")
    ]);
    if (!canView && !canCreate && !canEdit) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const conn = await pool.getConnection();
    try {
      const result = await loadActiveReturnReasonsForPreload(conn);
      return Response.json(result);
    } finally {
      conn.release();
    }
  } catch (error) {
    return jsonApiErrorForAction(error, "loadReturnCaseReturnReasons", {
      logLabel: "Return Case return-reasons API"
    });
  }
}
