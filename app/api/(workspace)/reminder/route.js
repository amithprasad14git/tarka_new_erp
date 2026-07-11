// Application API route — reminder list and create for My Reminders dashboard widget.

/**
 * GET /api/reminder?status=&dueDate=
 * POST /api/reminder — create reminder
 * Requires dashboard_my_reminders permission (canAccessDashboard my_reminders).
 */

import { requireRequestUser } from "../../../../lib/requestSession";
import { canAccessDashboard } from "../../../../lib/dashboards/dashboardAccess";
import {
  listRemindersForDashboard,
  getStatusCountsForUser,
  createReminderFromDashboard
} from "../../../../lib/modules/reminderDashboard.service";
import { jsonApiErrorForAction } from "../../../../lib/apiErrorResponse";

async function assertDashboardReminderAccess(user) {
  const allowed = await canAccessDashboard(user, "my_reminders");
  if (!allowed) return { status: 403, body: { error: "Forbidden" } };
  return null;
}

/**
 * GET /api/reminder — list reminders (status / dueDate filters) for the dashboard.
 */
export async function GET(req) {
  try {
    const auth = await requireRequestUser(req);
    if (auth.unauthorized) return auth.unauthorized;
    const user = auth.user;
    const denied = await assertDashboardReminderAccess(user);
    if (denied) return Response.json(denied.body, { status: denied.status });

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const dueDate = url.searchParams.get("dueDate");
    const countsOnly = url.searchParams.get("counts") === "1";

    if (countsOnly) {
      const result = await getStatusCountsForUser(user);
      return Response.json({ ok: true, ...result }, { status: 200 });
    }

    const rows = await listRemindersForDashboard(user, {
      status: status || undefined,
      dueDate: dueDate || undefined
    });
    return Response.json({ ok: true, status: status || null, dueDate: dueDate || null, rows }, { status: 200 });
  } catch (error) {
    return jsonApiErrorForAction(error, "loadReminders", { logLabel: "Reminder GET" });
  }
}

/**
 * POST /api/reminder — create a reminder from the dashboard.
 */
export async function POST(req) {
  try {
    const auth = await requireRequestUser(req);
    if (auth.unauthorized) return auth.unauthorized;
    const user = auth.user;
    const denied = await assertDashboardReminderAccess(user);
    if (denied) return Response.json(denied.body, { status: denied.status });

    const body = await req.json();
    const result = await createReminderFromDashboard(user, body);
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    return jsonApiErrorForAction(error, "createReminder", { logLabel: "Reminder POST" });
  }
}

