/**
 * POST — enrich audit compare snapshot JSON with lookup display labels.
 * Body: { moduleKey, oldData?, newData? }
 */
import { cookies } from "next/headers";
import { getSessionUser } from "../../../../lib/session";
import { hasModulePermission } from "../../../../lib/rbac";
import { enrichAuditCompareSnapshot } from "../../../../lib/modules/auditLogsEnrich";

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get("session")?.value;
    const user = await getSessionUser(sid);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
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

    const [enrichedOld, enrichedNew] = await Promise.all([
      oldData ? enrichAuditCompareSnapshot(moduleKey, oldData) : null,
      newData ? enrichAuditCompareSnapshot(moduleKey, newData) : null
    ]);

    return Response.json({ oldData: enrichedOld, newData: enrichedNew });
  } catch (e) {
    console.error("audit-logs/enrich-compare:", e);
    return Response.json({ error: "Failed to enrich compare data" }, { status: 500 });
  }
}
