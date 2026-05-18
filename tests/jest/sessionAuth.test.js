// Test file for validating app behavior and regression safety.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Focused session-auth tests for lib/session.js
 *
 * Note: lib/session.js does not currently export a `requireAuth` helper.
 * These tests cover the equivalent auth gate behavior through `getSessionUser`.
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
  escapeSqlTableId: jest.fn((name) => `\`${String(name)}\``)
}));

const pool = require("../../lib/db").default;
const { getSessionUser, getSession, refreshSessionExpiry } = require("../../lib/session");

describe("session auth behavior (getSessionUser focused)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("valid session retrieval returns user and refreshes sliding expiry", async () => {
    const user = { id: 7, fullName: "Demo", email: "demo@example.com", role: 2, unit: 5 };
    pool.query
      .mockResolvedValueOnce([[user]]) // join sessions->users
      .mockResolvedValueOnce([{ affectedRows: 1 }]); // refresh update

    await expect(getSessionUser("sid-valid")).resolves.toEqual(user);
    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      "UPDATE `sessions` SET expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id=? AND expires_at > NOW()",
      [20, "sid-valid"]
    );
  });

  test("session expiration rejection returns null (no user row)", async () => {
    pool.query.mockResolvedValueOnce([[]]);
    await expect(getSessionUser("sid-expired")).resolves.toBeNull();
  });

  test("invalid session token returns null", async () => {
    pool.query.mockResolvedValueOnce([[]]);
    await expect(getSessionUser("sid-invalid")).resolves.toBeNull();
  });

  test("missing session cookie/token returns null without DB call", async () => {
    await expect(getSessionUser("")).resolves.toBeNull();
    await expect(getSessionUser(undefined)).resolves.toBeNull();
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("malformed cookie/token is safely parameterized and rejected", async () => {
    const malformed = "' OR 1=1 --";
    pool.query.mockResolvedValueOnce([[]]);
    await expect(getSessionUser(malformed)).resolves.toBeNull();
    expect(pool.query).toHaveBeenCalledWith(
      "SELECT u.id, u.fullName, u.email, u.role, u.unit\n     FROM `sessions` s\n     JOIN `users` u ON u.id = s.user_id\n     WHERE s.id=? AND s.expires_at > NOW()\n       AND LOWER(TRIM(COALESCE(u.active, ''))) = 'yes'\n     LIMIT 1",
      [malformed]
    );
  });

  test("inactive user handling returns null (filtered by SQL active=yes)", async () => {
    pool.query.mockResolvedValueOnce([[]]);
    await expect(getSessionUser("sid-inactive-user")).resolves.toBeNull();
  });

  test("database query failure in getSessionUser is propagated", async () => {
    pool.query.mockRejectedValueOnce(new Error("db down"));
    await expect(getSessionUser("sid-any")).rejects.toThrow("db down");
  });

  test("database query failure in sliding refresh is propagated after valid user", async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 7, fullName: "Demo", email: "demo@example.com", role: 2, unit: 5 }]])
      .mockRejectedValueOnce(new Error("refresh failed"));
    await expect(getSessionUser("sid-refresh")).rejects.toThrow("refresh failed");
  });
});

describe("session auth helper primitives", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("getSession returns row for valid token and nullish for missing token", async () => {
    pool.query.mockResolvedValueOnce([[{ id: "sid-1", user_id: 11 }]]);
    await expect(getSession("sid-1")).resolves.toEqual({ id: "sid-1", user_id: 11 });
    await expect(getSession(null)).resolves.toBeNull();
  });

  test("refreshSessionExpiry no-ops for missing token", async () => {
    await expect(refreshSessionExpiry(undefined)).resolves.toBeUndefined();
    expect(pool.query).not.toHaveBeenCalled();
  });
});

