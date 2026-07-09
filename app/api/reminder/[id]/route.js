// Application API route — reminder detail and update for My Reminders dashboard widget.

/**
 * GET /api/reminder/[id]
 * PATCH /api/reminder/[id]
 * Requires dashboard_my_reminders permission.
 */

import { requireRequestUser } from "../../../../lib/requestSession";
import { canAccessDashboard } from "../../../../lib/dashboards/dashboardAccess";
import {
  getReminderDetailForDashboard,
  updateReminderFromDashboard
} from "../../../../lib/modules/reminderDashboard.service";
import { jsonApiErrorForAction } from "../../../../lib/apiErrorResponse";

async function assertDashboardReminderAccess(user) {
  const allowed = await canAccessDashboard(user, "my_reminders");
  if (!allowed) return { status: 403, body: { error: "Forbidden" } };
  return null;
}

export async function GET(req, { params }) {
  try {
    const auth = await requireRequestUser(req);
    if (auth.unauthorized) return auth.unauthorized;
    const user = auth.user;
    const denied = await assertDashboardReminderAccess(user);
    if (denied) return Response.json(denied.body, { status: denied.status });

    const { id } = await params;
    const result = await getReminderDetailForDashboard(user, id);
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    return jsonApiErrorForAction(error, "getReminder", { logLabel: "Reminder GET id" });
  }
}

export async function PATCH(req, { params }) {
  try {
    const auth = await requireRequestUser(req);
    if (auth.unauthorized) return auth.unauthorized;
    const user = auth.user;
    const denied = await assertDashboardReminderAccess(user);
    if (denied) return Response.json(denied.body, { status: denied.status });

    const { id } = await params;
    const body = await req.json();
    const result = await updateReminderFromDashboard(user, id, body);
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    return jsonApiErrorForAction(error, "updateReminder", { logLabel: "Reminder PATCH" });
  }
}
