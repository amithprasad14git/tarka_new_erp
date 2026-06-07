// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `session`.
 * Run with: npm test
 */

// Test file for validating app behavior and regression safety.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Comprehensive tests for lib/session.js
 */

// Replace real database, auth, and Next.js pieces with fakes so tests run offline.
jest.mock("crypto", () => ({
  randomUUID: jest.fn(() => "session-uuid-123")
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
  escapeSqlTableId: jest.fn((name) => `\`${String(name)}\``)
}));

const pool = require("../../lib/db").default;
const { randomUUID } = require("crypto");

const {
  createSession,
  refreshSessionExpiry,
  getSession,
  deleteSession,
  getSessionUser
} = require("../../lib/session");

// Checks whether a logged-in cookie still works, expires, or is rejected.
describe("session", () => {
  // Reset mocks and default stubs before each example runs.
  beforeEach(() => {
    jest.clearAllMocks();
  });

// Checks whether a logged-in cookie still works, expires, or is rejected.
  describe("createSession", () => {
    test("session creation inserts DB row and returns generated id", async () => {
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

      await expect(createSession(42)).resolves.toBe("session-uuid-123");
      expect(randomUUID).toHaveBeenCalledTimes(1);
      expect(pool.query).toHaveBeenCalledWith(
        "INSERT INTO `sessions` (id, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))",
        ["session-uuid-123", 42, 20]
      );
    });

    test("database failure handling: createSession propagates DB error", async () => {
      pool.query.mockRejectedValueOnce(new Error("insert failed"));
      await expect(createSession(42)).rejects.toThrow("insert failed");
    });
  });

// Checks whether a logged-in cookie still works, expires, or is rejected.
  describe("getSession", () => {
    test("valid session retrieval", async () => {
      pool.query.mockResolvedValueOnce([[{ id: "sid-1", user_id: 9, expires_at: "2099-01-01 00:00:00" }]]);
      await expect(getSession("sid-1")).resolves.toEqual({
        id: "sid-1",
        user_id: 9,
        expires_at: "2099-01-01 00:00:00"
      });
    });

    test("expired session rejection / invalid token rejection returns null", async () => {
      pool.query.mockResolvedValueOnce([[]]);
      await expect(getSession("unknown-or-expired")).resolves.toBeUndefined();
    });

    test("missing cookie/token (empty id) returns null without DB call", async () => {
      await expect(getSession("")).resolves.toBeNull();
      await expect(getSession(null)).resolves.toBeNull();
      expect(pool.query).not.toHaveBeenCalled();
    });

    test("malformed cookie/token still uses parameterized query safely", async () => {
      const malformed = "'; DROP TABLE sessions; --";
      pool.query.mockResolvedValueOnce([[]]);
      await expect(getSession(malformed)).resolves.toBeUndefined();
      expect(pool.query).toHaveBeenCalledWith(
        "SELECT * FROM `sessions` WHERE id=? AND expires_at > NOW()",
        [malformed]
      );
    });

    test("database failure handling: getSession propagates DB error", async () => {
      pool.query.mockRejectedValueOnce(new Error("select failed"));
      await expect(getSession("sid-1")).rejects.toThrow("select failed");
    });
  });

// Checks whether a logged-in cookie still works, expires, or is rejected.
  describe("refreshSessionExpiry", () => {
    test("sliding session refresh updates expiry for active session id", async () => {
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
      await expect(refreshSessionExpiry("sid-1")).resolves.toBeUndefined();
      expect(pool.query).toHaveBeenCalledWith(
        "UPDATE `sessions` SET expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id=? AND expires_at > NOW()",
        [20, "sid-1"]
      );
    });

    test("missing token does nothing", async () => {
      await expect(refreshSessionExpiry("")).resolves.toBeUndefined();
      await expect(refreshSessionExpiry(null)).resolves.toBeUndefined();
      expect(pool.query).not.toHaveBeenCalled();
    });

    test("database failure handling: refresh propagates DB error", async () => {
      pool.query.mockRejectedValueOnce(new Error("update failed"));
      await expect(refreshSessionExpiry("sid-1")).rejects.toThrow("update failed");
    });
  });

// Checks whether a logged-in cookie still works, expires, or is rejected.
  describe("deleteSession", () => {
    test("session deletion/logout deletes row by id", async () => {
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
      await expect(deleteSession("sid-1")).resolves.toBeUndefined();
      expect(pool.query).toHaveBeenCalledWith("DELETE FROM `sessions` WHERE id=?", ["sid-1"]);
    });

    test("missing token no-op for logout path", async () => {
      await expect(deleteSession("")).resolves.toBeUndefined();
      await expect(deleteSession(null)).resolves.toBeUndefined();
      expect(pool.query).not.toHaveBeenCalled();
    });

    test("database failure handling: deleteSession propagates DB error", async () => {
      pool.query.mockRejectedValueOnce(new Error("delete failed"));
      await expect(deleteSession("sid-1")).rejects.toThrow("delete failed");
    });
  });

// Checks whether a logged-in cookie still works, expires, or is rejected.
  describe("getSessionUser", () => {
    test("returns user for valid active session and triggers sliding refresh", async () => {
      const user = { id: 7, fullName: "A", email: "a@x.com", role: 2, unit: 5 };
      pool.query
        .mockResolvedValueOnce([[user]]) // join query
        .mockResolvedValueOnce([{ affectedRows: 1 }]); // refresh query

      await expect(getSessionUser("sid-1")).resolves.toEqual(user);
      expect(pool.query).toHaveBeenNthCalledWith(
        1,
        "SELECT u.id, u.fullName, u.email, u.role, u.unit\n     FROM `sessions` s\n     JOIN `users` u ON u.id = s.user_id\n     WHERE s.id=? AND s.expires_at > NOW()\n       AND LOWER(TRIM(COALESCE(u.active, ''))) = 'yes'\n     LIMIT 1",
        ["sid-1"]
      );
      expect(pool.query).toHaveBeenNthCalledWith(
        2,
        "UPDATE `sessions` SET expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id=? AND expires_at > NOW()",
        [20, "sid-1"]
      );
    });

    test("invalid token rejection: returns null when no active user row joined", async () => {
      pool.query.mockResolvedValueOnce([[]]);
      await expect(getSessionUser("invalid-token")).resolves.toBeNull();
    });

    test("inactive user session rejected (join filter yields no row)", async () => {
      pool.query.mockResolvedValueOnce([[]]);
      await expect(getSessionUser("sid-inactive")).resolves.toBeNull();
    });

    test("missing cookie/session id returns null without DB lookup", async () => {
      await expect(getSessionUser("")).resolves.toBeNull();
      await expect(getSessionUser(undefined)).resolves.toBeNull();
      expect(pool.query).not.toHaveBeenCalled();
    });

    test("malformed cookie token is parameterized and safely handled", async () => {
      const malformed = "sid'; --";
      pool.query.mockResolvedValueOnce([[]]);
      await expect(getSessionUser(malformed)).resolves.toBeNull();
      expect(pool.query).toHaveBeenCalledWith(
        "SELECT u.id, u.fullName, u.email, u.role, u.unit\n     FROM `sessions` s\n     JOIN `users` u ON u.id = s.user_id\n     WHERE s.id=? AND s.expires_at > NOW()\n       AND LOWER(TRIM(COALESCE(u.active, ''))) = 'yes'\n     LIMIT 1",
        [malformed]
      );
    });

    test("database failure handling: getSessionUser propagates DB error", async () => {
      pool.query.mockRejectedValueOnce(new Error("join failed"));
      await expect(getSessionUser("sid-1")).rejects.toThrow("join failed");
    });
  });
});


