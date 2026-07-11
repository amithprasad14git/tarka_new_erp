// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `api.auth.logout.route`.
 * Run with: npm test
 */

// Test file for validating app behavior and regression safety.
// Keep module-specific business logic in lib/modules/<module> files.

// Replace real database, auth, and Next.js pieces with fakes so tests run offline.
jest.mock("next/headers", () => ({
  cookies: jest.fn()
}));

jest.mock("../../lib/session", () => ({
  deleteSession: jest.fn()
}));

const { cookies } = require("next/headers");
const { deleteSession } = require("../../lib/session");
const { POST } = require("../../app/api/(auth)/auth/logout/route");

// Automated checks for: api/auth/logout route.
describe("api/auth/logout route", () => {
  let consoleErrorSpy;

  // Reset mocks and default stubs before each example runs.
  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test("deletes session row and clears cookie", async () => {
    const cookieStore = {
      get: jest.fn().mockReturnValue({ value: "sid-logout" }),
      delete: jest.fn()
    };
    cookies.mockResolvedValue(cookieStore);

    const res = await POST();
    expect(res.status).toBe(200);
    expect(deleteSession).toHaveBeenCalledWith("sid-logout");
    expect(cookieStore.delete).toHaveBeenCalledWith("session");
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  test("returns 500 when deleteSession throws", async () => {
    const cookieStore = {
      get: jest.fn().mockReturnValue({ value: "sid-logout" }),
      delete: jest.fn()
    };
    cookies.mockResolvedValue(cookieStore);
    deleteSession.mockRejectedValue(new Error("db down"));

    const res = await POST();
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Logout failed" });
  });
});



