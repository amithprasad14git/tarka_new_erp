/**
 * GET /api/return-case/cc-to?caseId={nciId}
 * Returns auto-fill text for Return Case "CC To" from NCI branch → bank cascade.
 */

import { cookies } from "next/headers";
import pool from "../../../../../lib/db";
import { hasModulePermission } from "../../../../../lib/rbac";
import { getSessionUser } from "../../../../../lib/session";
import { resolveReturnCaseCcToByCaseId } from "../../../../../lib/modules/returnCase";
import { jsonApiErrorForAction, jsonUnauthorizedForSession } from "../../../../../lib/apiErrorResponse";

/**
 * GET /api/return-case/cc-to — CC-to options for Return Case letters.
 */
export async function GET(req) {
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

    const url = new URL(req.url);
    const caseId = Number(url.searchParams.get("caseId"));
    if (!Number.isFinite(caseId) || caseId <= 0) {
      return Response.json({ ccTo: "" });
    }

    const conn = await pool.getConnection();
    try {
      const result = await resolveReturnCaseCcToByCaseId(conn, caseId);
      return Response.json(result);
    } finally {
      conn.release();
    }
  } catch (error) {
    return jsonApiErrorForAction(error, "loadReturnCaseCcTo", { logLabel: "Return Case CC To API" });
  }
}
