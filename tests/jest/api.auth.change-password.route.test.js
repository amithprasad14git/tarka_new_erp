// Test file for validating app behavior and regression safety.
// Keep module-specific business logic in lib/modules/<module> files.

jest.mock("next/headers", () => ({
  cookies: jest.fn()
}));

jest.mock("../../lib/session", () => ({
  getSessionUser: jest.fn()
}));

jest.mock("../../lib/db", () => {
  const query = jest.fn();
  return {
    __esModule: true,
    default: { query },
    queryWithRetry: (sql, values) => query(sql, values)
  };
});

jest.mock("../../lib/sqlModuleTable", () => ({
  escapeSqlTableId: jest.fn(() => "`users`")
}));

const { cookies } = require("next/headers");
const { getSessionUser } = require("../../lib/session");
const pool = require("../../lib/db").default;
const { POST } = require("../../app/api/auth/change-password/route");

function makeReq(body) {
  return { json: jest.fn().mockResolvedValue(body) };
}

describe("api/auth/change-password route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cookies.mockResolvedValue({ get: jest.fn().mockReturnValue({ value: "sid-1" }) });
  });

  test("returns 401 when session user is missing", async () => {
    getSessionUser.mockResolvedValue(null);
    const res = await POST(makeReq({}));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  test("returns 400 for missing fields", async () => {
    getSessionUser.mockResolvedValue({ id: 1 });
    const res = await POST(makeReq({ currentPassword: "", newPassword: "", confirmPassword: "" }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "All password fields are required." });
  });

  test("returns 400 when new and confirm do not match", async () => {
    getSessionUser.mockResolvedValue({ id: 1 });
    const res = await POST(
      makeReq({ currentPassword: "old12345", newPassword: "new12345", confirmPassword: "new12346" })
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "New password and confirm password do not match." });
  });

  test("returns 400 when current password is incorrect", async () => {
    getSessionUser.mockResolvedValue({ id: 1 });
    pool.query.mockResolvedValueOnce([[{ id: 1, password: "old12345" }]]);
    const res = await POST(
      makeReq({ currentPassword: "wrong", newPassword: "new12345", confirmPassword: "new12345" })
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Current password is incorrect." });
  });

  test("updates password and returns success", async () => {
    getSessionUser.mockResolvedValue({ id: 1 });
    pool.query
      .mockResolvedValueOnce([[{ id: 1, password: "old12345" }]]) // SELECT
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE
    const res = await POST(
      makeReq({ currentPassword: "old12345", newPassword: "new12345", confirmPassword: "new12345" })
    );
    expect(res.status).toBe(200);
    expect(pool.query).toHaveBeenNthCalledWith(2, "UPDATE `users` SET password = ? WHERE id = ?", ["new12345", 1]);
    await expect(res.json()).resolves.toEqual({ ok: true, message: "Password changed successfully." });
  });
});

