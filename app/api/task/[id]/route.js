// Application API route — task detail and update for My Tasks dashboard widget.

/**
 * GET /api/task/[id]
 * PATCH /api/task/[id]
 * Requires dashboard_my_tasks permission.
 */

import { requireRequestUser } from "../../../../lib/requestSession";
import { canAccessDashboard } from "../../../../lib/dashboards/dashboardAccess";
import {
  getTaskDetailForDashboard,
  updateTaskFromDashboard
} from "../../../../lib/modules/taskDashboard.service";
import { jsonApiErrorForAction } from "../../../../lib/apiErrorResponse";

async function assertDashboardTaskAccess(user) {
  const allowed = await canAccessDashboard(user, "my_tasks");
  if (!allowed) return { status: 403, body: { error: "Forbidden" } };
  return null;
}

export async function GET(req, { params }) {
  try {
    const auth = await requireRequestUser(req);
    if (auth.unauthorized) return auth.unauthorized;
    const user = auth.user;
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
    const auth = await requireRequestUser(req);
    if (auth.unauthorized) return auth.unauthorized;
    const user = auth.user;
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
