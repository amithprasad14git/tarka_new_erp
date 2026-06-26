/**
 * Tests for GET /api/reminder/alerts
 */

jest.mock("next/headers", () => ({
  cookies: jest.fn()
}));

jest.mock("../../lib/session", () => ({
  getSessionUser: jest.fn()
}));

jest.mock("../../lib/dashboards/dashboardAccess", () => ({
  canAccessDashboard: jest.fn()
}));

jest.mock("../../lib/modules/reminderDashboard.service", () => ({
  loadReminderAlerts: jest.fn()
}));

const { cookies } = require("next/headers");
const { getSessionUser } = require("../../lib/session");
const { canAccessDashboard } = require("../../lib/dashboards/dashboardAccess");
const { loadReminderAlerts } = require("../../lib/modules/reminderDashboard.service");
const { GET } = require("../../app/api/reminder/alerts/route");

describe("api/reminder/alerts route", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    cookies.mockResolvedValue({ get: jest.fn(() => ({ value: "sid-1" })) });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test("GET returns 401 without session", async () => {
    getSessionUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  test("GET returns 403 without dashboard_my_reminders permission", async () => {
    getSessionUser.mockResolvedValue({ id: 5, role: 2 });
    canAccessDashboard.mockResolvedValue(false);
    const res = await GET();
    expect(res.status).toBe(403);
    expect(canAccessDashboard).toHaveBeenCalledWith({ id: 5, role: 2 }, "my_reminders");
  });

  test("GET returns alert payload when allowed", async () => {
    getSessionUser.mockResolvedValue({ id: 5, role: 2 });
    canAccessDashboard.mockResolvedValue(true);
    loadReminderAlerts.mockResolvedValue({
      overdueCount: 2,
      dueTodayCount: 1,
      alertCount: 3,
      items: [{ id: 1, reminderTitle: "Follow up", dueDate: "2026-06-01", isOverdue: true }]
    });

    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        overdueCount: 2,
        dueTodayCount: 1,
        alertCount: 3,
        items: expect.any(Array)
      })
    );
    expect(loadReminderAlerts).toHaveBeenCalledWith({ id: 5, role: 2 });
  });
});
