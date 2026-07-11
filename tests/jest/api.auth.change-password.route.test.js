// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `api.auth.change-password.route`.
 * Run with: npm test
 */

// Test file for validating app behavior and regression safety.
// Keep module-specific business logic in lib/modules/<module> files.

// Replace real database, auth, and Next.js pieces with fakes so tests run offline.
jest.mock("next/headers", () => ({
  cookies: jest.fn()
}));

jest.mock("../../lib/session", () => {
  const { apiUserMessage } = require("../../lib/apiUserMessages");
  return {
    getSessionUser: jest.fn(),
    getSessionInvalidReason: jest.fn(),
    sessionErrorMessageForInvalidReason: (reason) =>
      reason === "replaced" ? apiUserMessage("sessionReplaced") : apiUserMessage("sessionExpired"),
    sessionLoginReasonForInvalid: (reason) => (reason === "replaced" ? "replaced" : "expired")
  };
});

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
const { getSessionUser, getSessionInvalidReason } = require("../../lib/session");
const pool = require("../../lib/db").default;
const { apiUserMessage } = require("../../lib/apiUserMessages");
const { POST } = require("../../app/api/(auth)/auth/change-password/route");

// Builds a fake HTTP request with a JSON body — used to call route handlers in tests.
function makeReq(body) {
  return { json: jest.fn().mockResolvedValue(body) };
}

const sessionUser = { id: 1, username: "demo.user" };
const validNewPassword = "NewSec9@key";

// Automated checks for: api/auth/change-password route.
describe("api/auth/change-password route", () => {
  // Reset mocks and default stubs before each example runs.
  beforeEach(() => {
    jest.clearAllMocks();
    cookies.mockResolvedValue({ get: jest.fn().mockReturnValue({ value: "sid-1" }) });
    getSessionUser.mockResolvedValue(sessionUser);
  });

  test("returns 401 when session user is missing", async () => {
    getSessionUser.mockResolvedValue(null);
    getSessionInvalidReason.mockResolvedValue("missing");
    const res = await POST(makeReq({}));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: apiUserMessage("sessionExpired"),
      reason: "expired"
    });
  });

  test("returns 400 for missing fields", async () => {
    const res = await POST(makeReq({ currentPassword: "", newPassword: "", confirmPassword: "" }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "All password fields are required." });
  });

  test("returns 400 when new password has no digit", async () => {
    const res = await POST(
      makeReq({
        currentPassword: "old12345",
        newPassword: "Secure@key",
        confirmPassword: "Secure@key"
      })
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "New password must include at least one number."
    });
  });

  test("returns 400 when new password has no allowed special character", async () => {
    const res = await POST(
      makeReq({
        currentPassword: "old12345",
        newPassword: "Secure9key",
        confirmPassword: "Secure9key"
      })
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "New password must include at least one special character (@ # $ % & *)."
    });
  });

  test("returns 400 when new password uses only disallowed specials", async () => {
    const res = await POST(
      makeReq({
        currentPassword: "old12345",
        newPassword: "Secure9!key",
        confirmPassword: "Secure9!key"
      })
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "New password must include at least one special character (@ # $ % & *)."
    });
  });

  test('returns 400 when new password contains the word "password"', async () => {
    const res = await POST(
      makeReq({
        currentPassword: "old12345",
        newPassword: "MyPassword1@",
        confirmPassword: "MyPassword1@"
      })
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'New password cannot contain the word "password".'
    });
  });

  test("returns 400 when new password contains session username", async () => {
    const res = await POST(
      makeReq({
        currentPassword: "old12345",
        newPassword: "demo.user9@",
        confirmPassword: "demo.user9@"
      })
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "New password cannot contain your username."
    });
  });

  test("returns 400 when new and confirm do not match", async () => {
    const res = await POST(
      makeReq({
        currentPassword: "old12345",
        newPassword: validNewPassword,
        confirmPassword: "NewSec9@key2"
      })
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "New password and confirm password do not match." });
  });

  test("returns 400 when current password is incorrect", async () => {
    pool.query.mockResolvedValueOnce([[{ id: 1, password: "old12345" }]]);
    const res = await POST(
      makeReq({
        currentPassword: "wrong",
        newPassword: validNewPassword,
        confirmPassword: validNewPassword
      })
    );
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Current password is incorrect." });
  });

  test("updates password and returns success", async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 1, password: "old12345" }]]) // SELECT
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE
    const res = await POST(
      makeReq({
        currentPassword: "old12345",
        newPassword: validNewPassword,
        confirmPassword: validNewPassword
      })
    );
    expect(res.status).toBe(200);
    expect(pool.query).toHaveBeenNthCalledWith(2, "UPDATE `users` SET password = ? WHERE id = ?", [
      validNewPassword,
      1
    ]);
    await expect(res.json()).resolves.toEqual({ ok: true, message: "Password changed successfully." });
  });
});

