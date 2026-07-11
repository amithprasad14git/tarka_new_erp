// Application API route — lightweight due/overdue task alerts for in-app notifications.

/**
 * GET /api/task/alerts
 * Requires dashboard_my_tasks permission.
 */

import { requireRequestUser } from "../../../../../lib/requestSession";
import { canAccessDashboard } from "../../../../../lib/dashboards/dashboardAccess";
import { loadTaskAlerts } from "../../../../../lib/modules/taskDashboard.service";
import { jsonApiErrorForAction } from "../../../../../lib/apiErrorResponse";

/**
 * GET /api/task/alerts — due/overdue tasks for the top-bar bell.
 */
export async function GET(req) {
  try {
    const auth = await requireRequestUser(req);
    if (auth.unauthorized) return auth.unauthorized;
    const user = auth.user;

    const allowed = await canAccessDashboard(user, "my_tasks");
    if (!allowed) return Response.json({ error: "Forbidden" }, { status: 403 });

    const alerts = await loadTaskAlerts(user);
    return Response.json({ ok: true, ...alerts }, { status: 200 });
  } catch (error) {
    return jsonApiErrorForAction(error, "loadTaskAlerts", { logLabel: "Task alerts GET" });
  }
}

