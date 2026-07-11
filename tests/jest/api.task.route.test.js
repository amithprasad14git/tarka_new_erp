/**
 * Tests for /api/task routes (dashboard permission gate).
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
  listTasksForDashboard: jest.fn(),
  getStatusCountsForBucket: jest.fn(),
  createTaskFromDashboard: jest.fn(),
  getTaskDetailForDashboard: jest.fn(),
  updateTaskFromDashboard: jest.fn(),
  normalizeBucket: jest.fn((b) => (String(b || "").toLowerCase() === "assigned_by_me" ? "assigned_by_me" : "assigned_to_me"))
}));

const { cookies } = require("next/headers");
const { getSessionUser, getSessionInvalidReason } = require("../../lib/session");
const { canAccessDashboard } = require("../../lib/dashboards/dashboardAccess");
const {
  listTasksForDashboard,
  getStatusCountsForBucket,
  createTaskFromDashboard,
  getTaskDetailForDashboard,
  updateTaskFromDashboard
} = require("../../lib/modules/taskDashboard.service");
const { GET, POST } = require("../../app/api/(workspace)/task/route");
const { GET: GET_ID, PATCH } = require("../../app/api/(workspace)/task/[id]/route");

function makeGetReq(url) {
  return { url: `http://localhost${url}` };
}

function makeJsonReq(body) {
  return { json: jest.fn().mockResolvedValue(body) };
}

describe("api/task routes", () => {
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
    const res = await GET(makeGetReq("/api/task"));
    expect(res.status).toBe(401);
  });

  test("GET returns 403 without dashboard_my_tasks permission", async () => {
    getSessionUser.mockResolvedValue({ id: 5, role: 2 });
    canAccessDashboard.mockResolvedValue(false);
    const res = await GET(makeGetReq("/api/task"));
    expect(res.status).toBe(403);
    expect(canAccessDashboard).toHaveBeenCalledWith({ id: 5, role: 2 }, "my_tasks");
  });

  test("GET counts=1 returns status counts", async () => {
    getSessionUser.mockResolvedValue({ id: 5, role: 2 });
    canAccessDashboard.mockResolvedValue(true);
    getStatusCountsForBucket.mockResolvedValue({ statusCounts: { Pending: 2 }, total: 2 });

    const res = await GET(makeGetReq("/api/task?bucket=assigned_to_me&counts=1"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(
      expect.objectContaining({ ok: true, bucket: "assigned_to_me", statusCounts: { Pending: 2 } })
    );
  });

  test("GET list returns rows", async () => {
    getSessionUser.mockResolvedValue({ id: 5, role: 2 });
    canAccessDashboard.mockResolvedValue(true);
    listTasksForDashboard.mockResolvedValue([{ id: 1, taskTitle: "A" }]);

    const res = await GET(makeGetReq("/api/task?bucket=assigned_to_me&status=Pending"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(
      expect.objectContaining({ ok: true, rows: [{ id: 1, taskTitle: "A" }] })
    );
    expect(listTasksForDashboard).toHaveBeenCalledWith(
      { id: 5, role: 2 },
      { bucket: "assigned_to_me", status: "Pending" }
    );
  });

  test("POST creates task when allowed", async () => {
    getSessionUser.mockResolvedValue({ id: 5, role: 2 });
    canAccessDashboard.mockResolvedValue(true);
    createTaskFromDashboard.mockResolvedValue({ status: 201, body: { id: 9 } });

    const res = await POST(makeJsonReq({ taskTitle: "New", assignee: 5 }));
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ id: 9 });
  });

  test("GET /api/task/[id] returns detail", async () => {
    getSessionUser.mockResolvedValue({ id: 5, role: 2 });
    canAccessDashboard.mockResolvedValue(true);
    getTaskDetailForDashboard.mockResolvedValue({ status: 200, body: { data: { id: 3 } } });

    const res = await GET_ID(makeGetReq("/api/task/3"), { params: Promise.resolve({ id: "3" }) });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: { id: 3 } });
  });

  test("PATCH /api/task/[id] updates task", async () => {
    getSessionUser.mockResolvedValue({ id: 5, role: 2 });
    canAccessDashboard.mockResolvedValue(true);
    updateTaskFromDashboard.mockResolvedValue({ status: 200, body: { data: { id: 3, status: "Completed" } } });

    const res = await PATCH(makeJsonReq({ status: "Completed" }), {
      params: Promise.resolve({ id: "3" })
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: { id: 3, status: "Completed" } });
  });
});
