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
  deleteSessionsForUser,
  refreshSessionExpiry,
  getSession,
  deleteSession,
  getSessionUser,
  getSessionInvalidReason
} = require("../../lib/session");
const {
  sessionErrorMessageForInvalidReason,
  sessionErrorMessageForLoginReason,
  sessionLoginReasonForInvalid
} = require("../../lib/sessionMessages");
const { apiUserMessage } = require("../../lib/apiUserMessages");

const SESSION_USER_SQL =
  "SELECT u.id, u.fullName, u.username, u.email, u.role, u.unit\n     FROM `sessions` s\n     JOIN `users` u ON u.id = s.user_id\n     WHERE s.id=? AND s.expires_at > NOW()\n       AND LOWER(TRIM(COALESCE(u.active, ''))) = 'yes'\n     LIMIT 1";

// Checks whether a logged-in cookie still works, expires, or is rejected.
describe("session", () => {
  // Reset mocks and default stubs before each example runs.
  beforeEach(() => {
    jest.clearAllMocks();
  });

// Checks whether a logged-in cookie still works, expires, or is rejected.
  describe("createSession", () => {
    test("session creation deletes prior rows, inserts DB row and returns generated id", async () => {
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]).mockResolvedValueOnce([{ affectedRows: 1 }]);

      await expect(createSession(42)).resolves.toBe("session-uuid-123");
      expect(randomUUID).toHaveBeenCalledTimes(1);
      expect(pool.query).toHaveBeenNthCalledWith(1, "DELETE FROM `sessions` WHERE user_id = ?", [42]);
      expect(pool.query).toHaveBeenNthCalledWith(
        2,
        "INSERT INTO `sessions` (id, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))",
        ["session-uuid-123", 42, 20]
      );
    });

    test("database failure handling: createSession propagates DB error", async () => {
      pool.query.mockRejectedValueOnce(new Error("insert failed"));
      await expect(createSession(42)).rejects.toThrow("insert failed");
    });
  });

  describe("deleteSessionsForUser", () => {
    test("deletes rows for user_id", async () => {
      pool.query.mockResolvedValueOnce([{ affectedRows: 2 }]);
      await expect(deleteSessionsForUser(42)).resolves.toBeUndefined();
      expect(pool.query).toHaveBeenCalledWith("DELETE FROM `sessions` WHERE user_id = ?", [42]);
    });

    test("no-op for invalid user id", async () => {
      await expect(deleteSessionsForUser(0)).resolves.toBeUndefined();
      expect(pool.query).not.toHaveBeenCalled();
    });
  });

  describe("getSessionInvalidReason", () => {
    test("returns missing when session id empty", async () => {
      await expect(getSessionInvalidReason("")).resolves.toBe("missing");
      expect(pool.query).not.toHaveBeenCalled();
    });

    test("returns replaced when session row absent", async () => {
      pool.query.mockResolvedValueOnce([[]]);
      await expect(getSessionInvalidReason("sid-1")).resolves.toBe("replaced");
    });

    test("returns expired when session row past expiry", async () => {
      pool.query
        .mockResolvedValueOnce([[{ expires_at: "2000-01-01", active: "Yes" }]])
        .mockResolvedValueOnce([[]]);
      await expect(getSessionInvalidReason("sid-1")).resolves.toBe("expired");
    });

    test("returns inactive_user when account not active", async () => {
      pool.query
        .mockResolvedValueOnce([[{ expires_at: "2099-01-01", active: "No" }]])
        .mockResolvedValueOnce([[{ id: "sid-1" }]]);
      await expect(getSessionInvalidReason("sid-1")).resolves.toBe("inactive_user");
    });

    test("returns null when session still valid", async () => {
      pool.query
        .mockResolvedValueOnce([[{ expires_at: "2099-01-01", active: "Yes" }]])
        .mockResolvedValueOnce([[{ id: "sid-1" }]]);
      await expect(getSessionInvalidReason("sid-1")).resolves.toBeNull();
    });
  });

  describe("session error message helpers", () => {
    test("maps invalid reasons to login reason and messages", () => {
      expect(sessionLoginReasonForInvalid("replaced")).toBe("replaced");
      expect(sessionLoginReasonForInvalid("expired")).toBe("expired");
      expect(sessionErrorMessageForInvalidReason("replaced")).toBe(apiUserMessage("sessionReplaced"));
      expect(sessionErrorMessageForInvalidReason("expired")).toBe(apiUserMessage("sessionExpired"));
      expect(sessionErrorMessageForLoginReason("inactive")).toBe(apiUserMessage("sessionInactive"));
      expect(sessionErrorMessageForLoginReason("replaced")).toBe(apiUserMessage("sessionReplaced"));
      expect(sessionErrorMessageForLoginReason("expired")).toBe(apiUserMessage("sessionExpired"));
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
      const user = { id: 7, fullName: "A", username: "a.user", email: "a@x.com", role: 2, unit: 5 };
      pool.query
        .mockResolvedValueOnce([[user]]) // join query
        .mockResolvedValueOnce([{ affectedRows: 1 }]); // refresh query

      await expect(getSessionUser("sid-1")).resolves.toEqual(user);
      expect(pool.query).toHaveBeenNthCalledWith(1, SESSION_USER_SQL, ["sid-1"]);
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
      expect(pool.query).toHaveBeenCalledWith(SESSION_USER_SQL, [malformed]);
    });

    test("returns user when sliding refresh fails (non-fatal)", async () => {
      const user = { id: 7, fullName: "A", username: "a.user", email: "a@x.com", role: 2, unit: 5 };
      pool.query
        .mockResolvedValueOnce([[user]])
        .mockRejectedValueOnce(new Error("update failed"));

      await expect(getSessionUser("sid-1")).resolves.toEqual(user);
    });

    test("database failure handling: getSessionUser propagates DB error", async () => {
      pool.query.mockRejectedValueOnce(new Error("join failed"));
      await expect(getSessionUser("sid-1")).rejects.toThrow("join failed");
    });
  });
});


