// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `auth`.
 * Run with: npm test
 */

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

const pool = require("../../lib/db").default;
const { authenticateLogin } = require("../../lib/auth");

describe("auth.authenticateLogin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("successful login with case-sensitive username", async () => {
    const user = { id: 1, username: "John.Doe", password: "secret", active: "Yes" };
    pool.query.mockResolvedValueOnce([[user]]);

    await expect(authenticateLogin("John.Doe", "secret")).resolves.toEqual({ user });
    expect(pool.query).toHaveBeenCalledWith("SELECT * FROM `users` WHERE username=?", ["John.Doe"]);
  });

  test("trims username before lookup", async () => {
    const user = { id: 1, username: "john", password: "secret", active: "Yes" };
    pool.query.mockResolvedValueOnce([[user]]);

    await expect(authenticateLogin("  john  ", "secret")).resolves.toEqual({ user });
    expect(pool.query).toHaveBeenCalledWith("SELECT * FROM `users` WHERE username=?", ["john"]);
  });

  test("username lookup is case-sensitive", async () => {
    pool.query.mockResolvedValueOnce([[]]);
    await expect(authenticateLogin("john", "secret")).resolves.toEqual({ error: "invalid_credentials" });
    expect(pool.query).toHaveBeenCalledWith("SELECT * FROM `users` WHERE username=?", ["john"]);
  });

  test("invalid password", async () => {
    pool.query.mockResolvedValueOnce([[{ id: 1, password: "secret", active: "Yes" }]]);

    await expect(authenticateLogin("john", "wrong")).resolves.toEqual({
      error: "invalid_credentials"
    });
  });

  test("unknown user", async () => {
    pool.query.mockResolvedValueOnce([[]]);
    await expect(authenticateLogin("missing.user", "secret")).resolves.toEqual({
      error: "invalid_credentials"
    });
  });

  test("inactive user", async () => {
    pool.query.mockResolvedValueOnce([[{ id: 1, password: "secret", active: "No" }]]);

    await expect(authenticateLogin("john", "secret")).resolves.toEqual({ error: "inactive" });
  });

  test("missing username skips database lookup", async () => {
    await expect(authenticateLogin("", "secret")).resolves.toEqual({ error: "invalid_credentials" });
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("missing password", async () => {
    pool.query.mockResolvedValueOnce([[{ id: 1, password: "secret", active: "Yes" }]]);

    await expect(authenticateLogin("john", "")).resolves.toEqual({
      error: "invalid_credentials"
    });
  });

  test("database query failure is propagated", async () => {
    pool.query.mockRejectedValueOnce(new Error("db unavailable"));
    await expect(authenticateLogin("john", "secret")).rejects.toThrow("db unavailable");
  });

  test("malformed user record (null row) throws", async () => {
    pool.query.mockResolvedValueOnce([[null]]);
    await expect(authenticateLogin("john", "secret")).rejects.toThrow();
  });

  test("SQL injection-safe parameter handling", async () => {
    const payload = "' OR 1=1 -- ";
    pool.query.mockResolvedValueOnce([[]]);

    await expect(authenticateLogin(payload, "secret")).resolves.toEqual({
      error: "invalid_credentials"
    });

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toBe("SELECT * FROM `users` WHERE username=?");
    expect(params).toEqual([payload.trim()]);
    expect(sql).not.toContain(payload);
  });
});

