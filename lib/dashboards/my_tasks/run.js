// Dashboard — My Tasks widget summary (status counts by bucket).

import { loadTaskDashboardSummary } from "../../modules/taskDashboard.service.js";

/**
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
