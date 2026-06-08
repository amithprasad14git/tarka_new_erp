// Application API route — dashboard KPI data (runtime aggregation).

/**
 * GET /api/dashboard/<key>
 * Session auth + dashboard permission; returns JSON payload for landing widgets.
 */

import { cookies } from "next/headers";
import { getSessionUser } from "../../../../lib/session";
import { loadDashboardForUser } from "../../../../lib/dashboards/dashboard.service";
import { jsonApiErrorForAction } from "../../../../lib/apiErrorResponse";

async function getRequestUser() {
  const cookieStore = await cookies();
  const sid = cookieStore.get("session")?.value;
  return getSessionUser(sid);
}

export async function GET(_req, { params }) {
  try {
    const user = await getRequestUser();
    const { key: dashboardKey } = await params;
    const result = await loadDashboardForUser(user, dashboardKey);

    if (result.status === 401) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (result.status === 403) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    if (result.status === 404) {
      return Response.json(result.body, { status: 404 });
    }
    if (result.status !== 200) {
      return Response.json(result.body || { error: "Failed to load dashboard" }, { status: result.status });
    }

    return Response.json(result.body, { status: 200 });
  } catch (error) {
    return jsonApiErrorForAction(error, "loadDashboard", { logLabel: "Dashboard GET" });
  }
}
