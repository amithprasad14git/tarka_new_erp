// Application API route — task list and create for My Tasks dashboard widget.

/**
 * GET /api/task?bucket=&status=
 * POST /api/task — create task
 * Requires dashboard_my_tasks permission (canAccessDashboard my_tasks).
 */

import { cookies } from "next/headers";
import { getSessionUser } from "../../../lib/session";
import { canAccessDashboard } from "../../../lib/dashboards/dashboardAccess";
import {
  listTasksForDashboard,
  getStatusCountsForBucket,
  createTaskFromDashboard,
  normalizeBucket
} from "../../../lib/modules/taskDashboard.service";
import { jsonApiErrorForAction } from "../../../lib/apiErrorResponse";

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

export async function GET(req) {
  try {
    const user = await getRequestUser();
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

export async function POST(req) {
  try {
    const user = await getRequestUser();
    const denied = await assertDashboardTaskAccess(user);
    if (denied) return Response.json(denied.body, { status: denied.status });

    const body = await req.json();
    const result = await createTaskFromDashboard(user, body);
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    return jsonApiErrorForAction(error, "createTask", { logLabel: "Task POST" });
  }
}
