// Shared dashboard service — permission check and dispatch to per-dashboard runners.

/**
 * Central loader used by GET /api/dashboard/<key>.
 */

import { isDashboardKey } from "../dashboardConfig";
import { canAccessDashboard } from "./dashboardAccess";
import { getDashboardRunner } from "./dashboardRegistry";

/**
 * @param {object | null} user
 * @param {string} dashboardKey
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function loadDashboardForUser(user, dashboardKey) {
  if (!isDashboardKey(dashboardKey)) {
    return { status: 404, body: { error: "Unknown dashboard" } };
  }

  if (!user) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  const canAccess = await canAccessDashboard(user, dashboardKey);
  if (!canAccess) {
    return { status: 403, body: { error: "Forbidden" } };
  }

  const runner = getDashboardRunner(dashboardKey);
  if (!runner?.loadDashboard) {
    return { status: 500, body: { error: "Dashboard runner not configured" } };
  }

  const result = await runner.loadDashboard(user);
  if (!result?.ok) {
    return {
      status: result?.status || 400,
      body: { error: result?.error || "Failed to load dashboard" }
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      key: dashboardKey,
      ...result.data
    }
  };
}
