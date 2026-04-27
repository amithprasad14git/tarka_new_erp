/**
 * Comprehensive tests for lib/auth.js
 */

jest.mock("bcryptjs", () => ({
  compareSync: jest.fn()
}));

jest.mock("../../lib/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn()
  }
}));

jest.mock("../../lib/sqlModuleTable", () => ({
  escapeSqlTableId: jest.fn(() => "`users`")
}));

const bcrypt = require("bcryptjs");
const pool = require("../../lib/db").default;
const { authenticateLogin } = require("../../lib/auth");

describe("auth.authenticateLogin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("successful login", async () => {
    const user = { id: 1, email: "user@example.com", password: "hashed", active: "Yes" };
    pool.query.mockResolvedValueOnce([[user]]);
    bcrypt.compareSync.mockReturnValueOnce(true);

    await expect(authenticateLogin("User@Example.com", "secret")).resolves.toEqual({ user });
    expect(pool.query).toHaveBeenCalledWith("SELECT * FROM `users` WHERE LOWER(email)=?", ["user@example.com"]);
    expect(bcrypt.compareSync).toHaveBeenCalledWith("secret", "hashed");
  });

  test("invalid password", async () => {
    pool.query.mockResolvedValueOnce([[{ id: 1, password: "hashed", active: "Yes" }]]);
    bcrypt.compareSync.mockReturnValueOnce(false);

    await expect(authenticateLogin("user@example.com", "wrong")).resolves.toEqual({
      error: "invalid_credentials"
    });
  });

  test("unknown user", async () => {
    pool.query.mockResolvedValueOnce([[]]);
    await expect(authenticateLogin("missing@example.com", "secret")).resolves.toEqual({
      error: "invalid_credentials"
    });
  });

  test("inactive user", async () => {
    pool.query.mockResolvedValueOnce([[{ id: 1, password: "hashed", active: "No" }]]);
    bcrypt.compareSync.mockReturnValueOnce(true);

    await expect(authenticateLogin("user@example.com", "secret")).resolves.toEqual({ error: "inactive" });
  });

  test("missing email", async () => {
    pool.query.mockResolvedValueOnce([[]]);
    await expect(authenticateLogin("", "secret")).resolves.toEqual({ error: "invalid_credentials" });
    expect(pool.query).toHaveBeenCalledWith("SELECT * FROM `users` WHERE LOWER(email)=?", [""]);
  });

  test("missing password", async () => {
    pool.query.mockResolvedValueOnce([[{ id: 1, password: "hashed", active: "Yes" }]]);
    bcrypt.compareSync.mockReturnValueOnce(false);

    await expect(authenticateLogin("user@example.com", "")).resolves.toEqual({
      error: "invalid_credentials"
    });
    expect(bcrypt.compareSync).toHaveBeenCalledWith("", "hashed");
  });

  test("bcrypt comparison failure falls back to plain-text legacy match", async () => {
    pool.query.mockResolvedValueOnce([[{ id: 1, password: "legacy-pass", active: "Yes" }]]);
    bcrypt.compareSync.mockImplementationOnce(() => {
      throw new Error("bad hash");
    });

    await expect(authenticateLogin("user@example.com", "legacy-pass")).resolves.toEqual({
      user: { id: 1, password: "legacy-pass", active: "Yes" }
    });
  });

  test("bcrypt comparison failure with no legacy match returns invalid credentials", async () => {
    pool.query.mockResolvedValueOnce([[{ id: 1, password: "legacy-pass", active: "Yes" }]]);
    bcrypt.compareSync.mockImplementationOnce(() => {
      throw new Error("bad hash");
    });

    await expect(authenticateLogin("user@example.com", "wrong")).resolves.toEqual({
      error: "invalid_credentials"
    });
  });

  test("database query failure is propagated", async () => {
    pool.query.mockRejectedValueOnce(new Error("db unavailable"));
    await expect(authenticateLogin("user@example.com", "secret")).rejects.toThrow("db unavailable");
  });

  test("malformed user record (null row) throws", async () => {
    pool.query.mockResolvedValueOnce([[null]]);
    await expect(authenticateLogin("user@example.com", "secret")).rejects.toThrow();
  });

  test("SQL injection-safe parameter handling", async () => {
    const payload = "' OR 1=1 -- ";
    pool.query.mockResolvedValueOnce([[]]);

    await expect(authenticateLogin(payload, "secret")).resolves.toEqual({
      error: "invalid_credentials"
    });

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toBe("SELECT * FROM `users` WHERE LOWER(email)=?");
    expect(params).toEqual([payload.trim().toLowerCase()]);
    expect(sql).not.toContain(payload);
  });
});

