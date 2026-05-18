// Test file for validating app behavior and regression safety.
// Keep module-specific business logic in lib/modules/<module> files.

jest.mock("next/headers", () => ({
  cookies: jest.fn()
}));

jest.mock("../../lib/auth", () => ({
  authenticateLogin: jest.fn()
}));

jest.mock("../../lib/session", () => ({
  createSession: jest.fn()
}));

jest.mock("../../lib/db", () => ({
  getMissingRequiredDbEnvVars: jest.fn(),
  getLoopbackDbHostError: jest.fn()
}));

const { cookies } = require("next/headers");
const { authenticateLogin } = require("../../lib/auth");
const { createSession } = require("../../lib/session");
const { getMissingRequiredDbEnvVars, getLoopbackDbHostError } = require("../../lib/db");
const { POST } = require("../../app/api/auth/login/route");

function makeReq(body) {
  return { json: jest.fn().mockResolvedValue(body) };
}

describe("api/auth/login route", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    getMissingRequiredDbEnvVars.mockReturnValue([]);
    getLoopbackDbHostError.mockReturnValue(null);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test("returns 503 when DB env vars are missing", async () => {
    getMissingRequiredDbEnvVars.mockReturnValue(["DB_HOST"]);
    const res = await POST(makeReq({ email: "u@x.com", password: "x" }));
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual(
      expect.objectContaining({ error: expect.stringContaining("Server is missing database configuration") })
    );
  });

  test("returns 503 when loopback DB host is detected", async () => {
    getLoopbackDbHostError.mockReturnValue("DB_HOST is localhost");
    const res = await POST(makeReq({ email: "u@x.com", password: "x" }));
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ error: "DB_HOST is localhost" });
  });

  test("returns 403 for inactive user", async () => {
    authenticateLogin.mockResolvedValue({ error: "inactive" });
    const res = await POST(makeReq({ email: "u@x.com", password: "x" }));
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "This account is inactive. Contact the administrator." });
  });

  test("returns 401 for invalid credentials", async () => {
    authenticateLogin.mockResolvedValue({ error: "invalid_credentials" });
    const res = await POST(makeReq({ email: "u@x.com", password: "bad" }));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Invalid Email or Password" });
  });

  test("creates session, sets cookie, and returns ok", async () => {
    const cookieStore = { set: jest.fn() };
    cookies.mockResolvedValue(cookieStore);
    authenticateLogin.mockResolvedValue({ user: { id: 11 } });
    createSession.mockResolvedValue("sid-11");

    const res = await POST(makeReq({ email: "u@x.com", password: "good" }));
    expect(res.status).toBe(200);
    expect(createSession).toHaveBeenCalledWith(11);
    expect(cookieStore.set).toHaveBeenCalledWith(
      "session",
      "sid-11",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" })
    );
    await expect(res.json()).resolves.toEqual({ ok: true });
  });
});

