// Application API route — dashboard KPI data for landing widgets.

/**
 * GET /api/dashboard/<key>
 * Returns JSON for one landing widget (recovery, invoices, regional performance, tasks, etc.).
 * Requires login + dashboard permission. See README.md#5a-landing-dashboards
 */

import { requireRequestUser } from "../../../../../lib/requestSession";
import { loadDashboardForUser } from "../../../../../lib/dashboards/dashboard.service";
import { jsonApiErrorForAction } from "../../../../../lib/apiErrorResponse";

/**
 * GET /api/dashboard/:key — run one registered dashboard widget and return its payload.
 */
export async function GET(req, { params }) {
  try {
    const auth = await requireRequestUser(req);
    if (auth.unauthorized) return auth.unauthorized;
    const user = auth.user;
    const { key: dashboardKey } = await params;
    const result = await loadDashboardForUser(user, dashboardKey);

    // Map service status codes to HTTP responses for the browser loader.
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

