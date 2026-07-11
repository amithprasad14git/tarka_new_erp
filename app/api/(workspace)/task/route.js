// Application API route — task list and create for My Tasks dashboard widget.

/**
 * GET /api/task?bucket=&status=
 * POST /api/task — create task
 * Requires dashboard_my_tasks permission (canAccessDashboard my_tasks).
 */

import { requireRequestUser } from "../../../../lib/requestSession";
import { canAccessDashboard } from "../../../../lib/dashboards/dashboardAccess";
import {
  listTasksForDashboard,
  getStatusCountsForBucket,
  createTaskFromDashboard,
  normalizeBucket
} from "../../../../lib/modules/taskDashboard.service";
import { jsonApiErrorForAction } from "../../../../lib/apiErrorResponse";

async function assertDashboardTaskAccess(user) {
  const allowed = await canAccessDashboard(user, "my_tasks");
  if (!allowed) return { status: 403, body: { error: "Forbidden" } };
  return null;
}

/**
 * GET /api/task — list tasks for the dashboard (bucket + status filters).
 */
export async function GET(req) {
  try {
    const auth = await requireRequestUser(req);
    if (auth.unauthorized) return auth.unauthorized;
    const user = auth.user;
    const denied = await assertDashboardTaskAccess(user);
    if (denied) return Response.json(denied.body, { status: denied.status });

    const url = new URL(req.url);
    const bucket = normalizeBucket(url.searchParams.get("bucket"));
    const status = url.searchParams.get("status");
    const countsOnly = url.searchParams.get("counts") === "1";

    if (countsOnly) {
      const result = await getStatusCountsForBucket(user, bucket);
      return Response.json({ ok: true, bucket, ...result }, { status: 200 });
    }

    const rows = await listTasksForDashboard(user, { bucket, status: status || undefined });
    return Response.json({ ok: true, bucket, status: status || null, rows }, { status: 200 });
  } catch (error) {
    return jsonApiErrorForAction(error, "loadTasks", { logLabel: "Task GET" });
  }
}

/**
 * POST /api/task — create a task from the dashboard.
 */
export async function POST(req) {
  try {
    const auth = await requireRequestUser(req);
    if (auth.unauthorized) return auth.unauthorized;
    const user = auth.user;
    const denied = await assertDashboardTaskAccess(user);
    if (denied) return Response.json(denied.body, { status: denied.status });

    const body = await req.json();
    const result = await createTaskFromDashboard(user, body);
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    return jsonApiErrorForAction(error, "createTask", { logLabel: "Task POST" });
  }
}

