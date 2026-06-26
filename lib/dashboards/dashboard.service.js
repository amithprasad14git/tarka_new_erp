// Shared dashboard service — permission check and dispatch to per-dashboard runners.

/**
 * Central entry for GET /api/dashboard/<key>.
 * Validates key, session, permission, then calls the matching runner in dashboardRegistry.
 * Guide: docs/DASHBOARDS.md
 */

import { isDashboardKey } from "../dashboardConfig";
import { canAccessDashboard } from "./dashboardAccess";
import { getDashboardRunner } from "./dashboardRegistry";

/**
 * Load one dashboard payload for the logged-in user.
 * @param {object | null} user
 * @param {string} dashboardKey
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function loadDashboardForUser(user, dashboardKey) {
  // Unknown keys return 404 before any database work.
  if (!isDashboardKey(dashboardKey)) {
    return { status: 404, body: { error: "Unknown dashboard" } };
  }

  if (!user) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  // Admin, matrix permission, or autoGrantForAssignedUnit (see dashboardAccess.js).
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

  // Merge ok + key into JSON body for the browser widget.
  return {
    status: 200,
    body: {
      ok: true,
      key: dashboardKey,
      ...result.data
    }
  };
}
