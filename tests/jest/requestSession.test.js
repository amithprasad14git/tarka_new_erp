/**
 * Tests for lib/requestSession.js
 */

jest.mock("../../lib/session", () => ({
  getSessionUser: jest.fn(),
  getSessionInvalidReason: jest.fn()
}));

const { getSessionUser, getSessionInvalidReason } = require("../../lib/session");
const { apiUserMessage } = require("../../lib/apiUserMessages");
const {
  sessionIdFromRequest,
  getRequestSession,
  requireRequestUser
} = require("../../lib/requestSession");

function mockReq(cookieHeader = "") {
  return {
    headers: {
      get: (name) => (String(name).toLowerCase() === "cookie" ? cookieHeader : null)
    }
  };
}

describe("requestSession", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSessionInvalidReason.mockResolvedValue("missing");
  });

  test("sessionIdFromRequest parses session cookie", () => {
    expect(sessionIdFromRequest(mockReq("session=abc-123"))).toBe("abc-123");
    expect(sessionIdFromRequest(mockReq("foo=1; session=tok%2F2; bar=3"))).toBe("tok/2");
    expect(sessionIdFromRequest(mockReq(""))).toBeUndefined();
    expect(sessionIdFromRequest(null)).toBeUndefined();
  });

  test("getRequestSession resolves user from cookie", async () => {
    getSessionUser.mockResolvedValue({ id: 5, role: 2 });
    const result = await getRequestSession(mockReq("session=sid-1"));
    expect(getSessionUser).toHaveBeenCalledWith("sid-1");
    expect(result.user).toEqual({ id: 5, role: 2 });
    expect(result.sid).toBe("sid-1");
  });

  test("requireRequestUser returns user when session valid", async () => {
    getSessionUser.mockResolvedValue({ id: 1, role: 1 });
    const result = await requireRequestUser(mockReq("session=sid-ok"));
    expect(result.unauthorized).toBeNull();
    expect(result.user).toEqual({ id: 1, role: 1 });
  });

  test("requireRequestUser returns 401 when session missing", async () => {
    getSessionUser.mockResolvedValue(null);
    const result = await requireRequestUser(mockReq(""));
    expect(result.user).toBeNull();
    expect(result.unauthorized).toBeDefined();
    expect(result.unauthorized.status).toBe(401);
    const body = await result.unauthorized.json();
    expect(body.error).toBe(apiUserMessage("sessionExpired"));
  });

  test("requireRequestUser returns 401 when getSessionUser throws", async () => {
    getSessionUser.mockRejectedValue(new Error("db down"));
    const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const result = await requireRequestUser(mockReq("session=sid-1"));
    expect(result.user).toBeNull();
    expect(result.unauthorized.status).toBe(401);
    errSpy.mockRestore();
  });
});
