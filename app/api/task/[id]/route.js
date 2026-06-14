// Application API route — task detail and update for My Tasks dashboard widget.

/**
 * GET /api/task/[id]
 * PATCH /api/task/[id]
 * Requires dashboard_my_tasks permission.
 */

import { cookies } from "next/headers";
import { getSessionUser } from "../../../../lib/session";
import { canAccessDashboard } from "../../../../lib/dashboards/dashboardAccess";
import {
  getTaskDetailForDashboard,
  updateTaskFromDashboard
} from "../../../../lib/modules/taskDashboard.service";
import { jsonApiErrorForAction } from "../../../../lib/apiErrorResponse";

async function getRequestUser() {
  const cookieStore = await cookies();
  const sid = cookieStore.get("session")?.value;
  return getSessionUser(sid);
}

async function assertDashboardTaskAccess(user) {
  if (!user) return { status: 401, body: { error: "Unauthorized" } };
  const allowed = await canAccessDashboard(user, "my_tasks");
  if (!allowed) return { status: 403, body: { error: "Forbidden" } };
  return null;
}

export async function GET(_req, { params }) {
  try {
    const user = await getRequestUser();
    const denied = await assertDashboardTaskAccess(user);
    if (denied) return Response.json(denied.body, { status: denied.status });

    const { id } = await params;
    const result = await getTaskDetailForDashboard(user, id);
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    return jsonApiErrorForAction(error, "getTask", { logLabel: "Task GET id" });
  }
}

export async function PATCH(req, { params }) {
  try {
    const user = await getRequestUser();
    const denied = await assertDashboardTaskAccess(user);
    if (denied) return Response.json(denied.body, { status: denied.status });

    const { id } = await params;
    const body = await req.json();
    const result = await updateTaskFromDashboard(user, id, body);
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    return jsonApiErrorForAction(error, "updateTask", { logLabel: "Task PATCH" });
  }
}
