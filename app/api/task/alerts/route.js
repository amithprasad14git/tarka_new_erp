// Application API route — lightweight due/overdue task alerts for in-app notifications.

/**
 * GET /api/task/alerts
 * Requires dashboard_my_tasks permission.
 */

import { cookies } from "next/headers";
import { getSessionUser } from "../../../../lib/session";
import { canAccessDashboard } from "../../../../lib/dashboards/dashboardAccess";
import { loadTaskAlerts } from "../../../../lib/modules/taskDashboard.service";
import { jsonApiErrorForAction } from "../../../../lib/apiErrorResponse";

async function getRequestUser() {
  const cookieStore = await cookies();
  const sid = cookieStore.get("session")?.value;
  return getSessionUser(sid);
}

export async function GET() {
  try {
    const user = await getRequestUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const allowed = await canAccessDashboard(user, "my_tasks");
    if (!allowed) return Response.json({ error: "Forbidden" }, { status: 403 });

    const alerts = await loadTaskAlerts(user);
    return Response.json({ ok: true, ...alerts }, { status: 200 });
  } catch (error) {
    return jsonApiErrorForAction(error, "loadTaskAlerts", { logLabel: "Task alerts GET" });
  }
}
