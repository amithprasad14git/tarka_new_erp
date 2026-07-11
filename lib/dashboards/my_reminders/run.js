// Dashboard — My Reminders landing widget server loader.

/**
 * Upcoming reminders for the logged-in user (admin may see broader view).
 * Service: lib/modules/reminderDashboard.service.js
 * UI: components/reminder/MyRemindersWidget.js
 */

import { loadReminderDashboardSummary } from "../../modules/reminderDashboard.service.js";

/**
 * Loads reminder summary for GET /api/dashboard/my_reminders.
 * @param {object} user
 * @returns {Promise<{ ok: boolean, data?: object, error?: string, status?: number }>}
 */
export async function loadDashboard(user) {
  if (!user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  try {
    const summary = await loadReminderDashboardSummary(user);
    const isAdminView = Number(user.role) === 1;
    return {
      ok: true,
      data: {
        ...summary,
        statuses: ["Pending", "Completed", "Cancelled"],
        isAdminView
      }
    };
  } catch (e) {
    console.error("my_reminders dashboard load failed:", e);
    return { ok: false, status: 500, error: "Failed to load reminders dashboard" };
  }
}

