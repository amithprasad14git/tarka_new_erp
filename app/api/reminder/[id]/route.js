// Application API route — reminder detail and update for My Reminders dashboard widget.

/**
 * GET /api/reminder/[id]
 * PATCH /api/reminder/[id]
 * Requires dashboard_my_reminders permission.
 */

import { cookies } from "next/headers";
import { getSessionUser } from "../../../../lib/session";
import { canAccessDashboard } from "../../../../lib/dashboards/dashboardAccess";
import {
  getReminderDetailForDashboard,
  updateReminderFromDashboard
} from "../../../../lib/modules/reminderDashboard.service";
import { jsonApiErrorForAction } from "../../../../lib/apiErrorResponse";

async function getRequestUser() {
  const cookieStore = await cookies();
  const sid = cookieStore.get("session")?.value;
  return getSessionUser(sid);
}

async function assertDashboardReminderAccess(user) {
  if (!user) return { status: 401, body: { error: "Unauthorized" } };
  const allowed = await canAccessDashboard(user, "my_reminders");
  if (!allowed) return { status: 403, body: { error: "Forbidden" } };
  return null;
}

export async function GET(_req, { params }) {
  try {
    const user = await getRequestUser();
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
    const user = await getRequestUser();
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
