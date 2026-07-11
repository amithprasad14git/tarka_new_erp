/**
 * Tests for GET /api/task/alerts
 */

jest.mock("next/headers", () => ({
  cookies: jest.fn()
}));

jest.mock("../../lib/session", () => ({
  getSessionUser: jest.fn(),
  getSessionInvalidReason: jest.fn()
}));

jest.mock("../../lib/dashboards/dashboardAccess", () => ({
  canAccessDashboard: jest.fn()
}));

jest.mock("../../lib/modules/taskDashboard.service", () => ({
  loadTaskAlerts: jest.fn()
}));

const { cookies } = require("next/headers");
const { getSessionUser, getSessionInvalidReason } = require("../../lib/session");
const { canAccessDashboard } = require("../../lib/dashboards/dashboardAccess");
const { loadTaskAlerts } = require("../../lib/modules/taskDashboard.service");
const { GET } = require("../../app/api/(workspace)/task/alerts/route");

describe("api/task/alerts route", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    getSessionInvalidReason.mockResolvedValue("missing");
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

  test("GET returns 403 without dashboard_my_tasks permission", async () => {
    getSessionUser.mockResolvedValue({ id: 5, role: 2 });
    canAccessDashboard.mockResolvedValue(false);
    const res = await GET();
    expect(res.status).toBe(403);
    expect(canAccessDashboard).toHaveBeenCalledWith({ id: 5, role: 2 }, "my_tasks");
  });

  test("GET returns alert payload when allowed", async () => {
    getSessionUser.mockResolvedValue({ id: 5, role: 2 });
    canAccessDashboard.mockResolvedValue(true);
    loadTaskAlerts.mockResolvedValue({
      overdueCount: 2,
      dueTodayCount: 1,
      alertCount: 3,
      items: [{ id: 1, taskTitle: "Follow up", dueDate: "2026-06-01", status: "Pending", isOverdue: true }]
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
    expect(loadTaskAlerts).toHaveBeenCalledWith({ id: 5, role: 2 });
  });
});
