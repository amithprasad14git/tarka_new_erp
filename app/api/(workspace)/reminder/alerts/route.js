// Application API route — lightweight due/overdue reminder alerts for in-app notifications.

/**
 * GET /api/reminder/alerts
 * Requires dashboard_my_reminders permission.
 */

import { requireRequestUser } from "../../../../../lib/requestSession";
import { canAccessDashboard } from "../../../../../lib/dashboards/dashboardAccess";
import { loadReminderAlerts } from "../../../../../lib/modules/reminderDashboard.service";
import { jsonApiErrorForAction } from "../../../../../lib/apiErrorResponse";

/**
 * GET /api/reminder/alerts — due/overdue reminders for the top-bar bell.
 */
export async function GET(req) {
  try {
    const auth = await requireRequestUser(req);
    if (auth.unauthorized) return auth.unauthorized;
    const user = auth.user;

    const allowed = await canAccessDashboard(user, "my_reminders");
    if (!allowed) return Response.json({ error: "Forbidden" }, { status: 403 });

    const alerts = await loadReminderAlerts(user);
    return Response.json({ ok: true, ...alerts }, { status: 200 });
  } catch (error) {
    return jsonApiErrorForAction(error, "loadReminderAlerts", { logLabel: "Reminder alerts GET" });
  }
}

