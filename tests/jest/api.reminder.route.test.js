/**
 * Tests for /api/reminder routes (dashboard permission gate).
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

jest.mock("../../lib/modules/reminderDashboard.service", () => ({
  listRemindersForDashboard: jest.fn(),
  getStatusCountsForUser: jest.fn(),
  createReminderFromDashboard: jest.fn(),
  getReminderDetailForDashboard: jest.fn(),
  updateReminderFromDashboard: jest.fn()
}));

const { cookies } = require("next/headers");
const { getSessionUser, getSessionInvalidReason } = require("../../lib/session");
const { canAccessDashboard } = require("../../lib/dashboards/dashboardAccess");
const {
  listRemindersForDashboard,
  getStatusCountsForUser,
  createReminderFromDashboard,
  getReminderDetailForDashboard,
  updateReminderFromDashboard
} = require("../../lib/modules/reminderDashboard.service");
const { GET, POST } = require("../../app/api/(workspace)/reminder/route");
const { GET: GET_ID, PATCH } = require("../../app/api/(workspace)/reminder/[id]/route");

function makeGetReq(url) {
  return { url: `http://localhost${url}` };
}

function makeJsonReq(body) {
  return { json: jest.fn().mockResolvedValue(body) };
}

describe("api/reminder routes", () => {
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
    const res = await GET(makeGetReq("/api/reminder"));
    expect(res.status).toBe(401);
  });

  test("GET returns 403 without dashboard_my_reminders permission", async () => {
    getSessionUser.mockResolvedValue({ id: 5, role: 2 });
    canAccessDashboard.mockResolvedValue(false);
    const res = await GET(makeGetReq("/api/reminder"));
    expect(res.status).toBe(403);
    expect(canAccessDashboard).toHaveBeenCalledWith({ id: 5, role: 2 }, "my_reminders");
  });

  test("GET counts=1 returns status counts", async () => {
    getSessionUser.mockResolvedValue({ id: 5, role: 2 });
    canAccessDashboard.mockResolvedValue(true);
    getStatusCountsForUser.mockResolvedValue({ statusCounts: { Pending: 2 }, total: 2 });

    const res = await GET(makeGetReq("/api/reminder?counts=1"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(
      expect.objectContaining({ ok: true, statusCounts: { Pending: 2 } })
    );
  });

  test("GET list returns rows", async () => {
    getSessionUser.mockResolvedValue({ id: 5, role: 2 });
    canAccessDashboard.mockResolvedValue(true);
    listRemindersForDashboard.mockResolvedValue([{ id: 1, reminderTitle: "Follow up" }]);

    const res = await GET(makeGetReq("/api/reminder?status=Pending"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(
      expect.objectContaining({ ok: true, rows: [{ id: 1, reminderTitle: "Follow up" }] })
    );
    expect(listRemindersForDashboard).toHaveBeenCalledWith(
      { id: 5, role: 2 },
      { status: "Pending", dueDate: undefined }
    );
  });

  test("GET list without status returns all statuses", async () => {
    getSessionUser.mockResolvedValue({ id: 5, role: 2 });
    canAccessDashboard.mockResolvedValue(true);
    listRemindersForDashboard.mockResolvedValue([
      { id: 1, reminderTitle: "Pending one", status: "Pending" },
      { id: 2, reminderTitle: "Done one", status: "Completed" }
    ]);

    const res = await GET(makeGetReq("/api/reminder"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        status: null,
        rows: expect.arrayContaining([
          expect.objectContaining({ id: 1 }),
          expect.objectContaining({ id: 2 })
        ])
      })
    );
    expect(listRemindersForDashboard).toHaveBeenCalledWith(
      { id: 5, role: 2 },
      { status: undefined, dueDate: undefined }
    );
  });

  test("POST creates reminder when allowed", async () => {
    getSessionUser.mockResolvedValue({ id: 5, role: 2 });
    canAccessDashboard.mockResolvedValue(true);
    createReminderFromDashboard.mockResolvedValue({ status: 201, body: { id: 9 } });

    const res = await POST(makeJsonReq({ reminderTitle: "New", dueDate: "2026-06-20" }));
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ id: 9 });
  });

  test("GET /api/reminder/[id] returns detail", async () => {
    getSessionUser.mockResolvedValue({ id: 5, role: 2 });
    canAccessDashboard.mockResolvedValue(true);
    getReminderDetailForDashboard.mockResolvedValue({ status: 200, body: { data: { id: 3 } } });

    const res = await GET_ID(makeGetReq("/api/reminder/3"), { params: Promise.resolve({ id: "3" }) });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: { id: 3 } });
  });

  test("PATCH /api/reminder/[id] updates reminder", async () => {
    getSessionUser.mockResolvedValue({ id: 5, role: 2 });
    canAccessDashboard.mockResolvedValue(true);
    updateReminderFromDashboard.mockResolvedValue({
      status: 200,
      body: { data: { id: 3, status: "Completed" } }
    });

    const res = await PATCH(makeJsonReq({ status: "Completed" }), {
      params: Promise.resolve({ id: "3" })
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: { id: 3, status: "Completed" } });
  });
});
