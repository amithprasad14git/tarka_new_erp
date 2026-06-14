// Application API route — reminder list and create for My Reminders dashboard widget.

/**
 * GET /api/reminder?status=&dueDate=
 * POST /api/reminder — create reminder
 * Requires dashboard_my_reminders permission (canAccessDashboard my_reminders).
 */

import { cookies } from "next/headers";
import { getSessionUser } from "../../../lib/session";
import { canAccessDashboard } from "../../../lib/dashboards/dashboardAccess";
import {
  listRemindersForDashboard,
  getStatusCountsForUser,
  createReminderFromDashboard
} from "../../../lib/modules/reminderDashboard.service";
import { jsonApiErrorForAction } from "../../../lib/apiErrorResponse";

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

export async function GET(req) {
  try {
    const user = await getRequestUser();
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

export async function POST(req) {
  try {
    const user = await getRequestUser();
    const denied = await assertDashboardReminderAccess(user);
    if (denied) return Response.json(denied.body, { status: denied.status });

    const body = await req.json();
    const result = await createReminderFromDashboard(user, body);
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    return jsonApiErrorForAction(error, "createReminder", { logLabel: "Reminder POST" });
  }
}
