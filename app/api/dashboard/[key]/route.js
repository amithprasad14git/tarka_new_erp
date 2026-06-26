// Application API route — dashboard KPI data for landing widgets.

/**
 * GET /api/dashboard/<key>
 * Returns JSON for one landing widget (recovery, invoices, regional performance, tasks, etc.).
 * Requires login + dashboard permission. See docs/DASHBOARDS.md
 */

import { cookies } from "next/headers";
import { getSessionUser } from "../../../../lib/session";
import { loadDashboardForUser } from "../../../../lib/dashboards/dashboard.service";
import { jsonApiErrorForAction } from "../../../../lib/apiErrorResponse";

async function getRequestUser() {
  // Resolve session cookie to logged-in user (same as other protected API routes).
  const cookieStore = await cookies();
  const sid = cookieStore.get("session")?.value;
  return getSessionUser(sid);
}

export async function GET(_req, { params }) {
  try {
    const user = await getRequestUser();
    const { key: dashboardKey } = await params;
    const result = await loadDashboardForUser(user, dashboardKey);

    // Map service status codes to HTTP responses for the browser loader.
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
