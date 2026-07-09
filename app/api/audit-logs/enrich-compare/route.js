// Application API route — enriches audit log data for display.

/**
 * POST — enrich audit compare snapshot JSON with lookup display labels.
 * Body: { moduleKey, oldData?, newData? }
 * Used when staff compare old vs new values on the audit log screen.
 */
import { cookies } from "next/headers";
import { getSessionUser } from "../../../../lib/session";
import { hasModulePermission } from "../../../../lib/rbac";
import { enrichAuditCompareSnapshot } from "../../../../lib/modules/auditLogsEnrich";
import { jsonApiErrorForAction, jsonUnauthorizedForSession } from "../../../../lib/apiErrorResponse";

// Replace raw FK ids in audit compare JSON with human-readable lookup labels.
export async function POST(request) {
  try {
    // Check login — only staff who may view audit logs should see compare data.
    const cookieStore = await cookies();
    const sid = cookieStore.get("session")?.value;
    const user = await getSessionUser(sid);
    if (!user) {
      return await jsonUnauthorizedForSession(sid);
    }

    const canView = await hasModulePermission(user, "audit_logs", "view");
    if (!canView) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const moduleKey = String(body?.moduleKey ?? "").trim();
    if (!moduleKey) {
      return Response.json({ error: "moduleKey is required" }, { status: 400 });
    }

    const oldData =
      body?.oldData && typeof body.oldData === "object" ? body.oldData : null;
    const newData =
      body?.newData && typeof body.newData === "object" ? body.newData : null;

    // Enrich old and new snapshots in parallel for the side-by-side compare UI.
    const [enrichedOld, enrichedNew] = await Promise.all([
      oldData ? enrichAuditCompareSnapshot(moduleKey, oldData) : null,
      newData ? enrichAuditCompareSnapshot(moduleKey, newData) : null
    ]);

    return Response.json({ oldData: enrichedOld, newData: enrichedNew });
  } catch (e) {
    return jsonApiErrorForAction(e, "enrichAuditCompare", { logLabel: "audit-logs/enrich-compare" });
  }
}
