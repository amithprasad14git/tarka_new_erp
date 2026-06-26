// Dashboard — My Tasks landing widget server loader.

/**
 * Task counts by status for the logged-in user.
 * Service: lib/modules/taskDashboard.service.js
 * UI: components/task/MyTasksWidget.js
 */

import { loadTaskDashboardSummary } from "../../modules/taskDashboard.service.js";

/**
 * Loads task summary for GET /api/dashboard/my_tasks.
 * @param {object} user
 * @returns {Promise<{ ok: boolean, data?: object, error?: string, status?: number }>}
 */
export async function loadDashboard(user) {
  if (!user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  try {
    const summary = await loadTaskDashboardSummary(user);
    return {
      ok: true,
      data: {
        ...summary,
        statuses: ["Pending", "In Progress", "Completed", "Cancelled"]
      }
    };
  } catch (e) {
    console.error("my_tasks dashboard load failed:", e);
    return { ok: false, status: 500, error: "Failed to load tasks dashboard" };
  }
}
