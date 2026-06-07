// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `rbac`.
 * Run with: npm test
 */

// Test file for validating app behavior and regression safety.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Comprehensive tests for lib/rbac.js
 */

// Replace real database, auth, and Next.js pieces with fakes so tests run offline.
jest.mock("mysql2", () => ({
  escapeId: jest.fn((v) => `\`${String(v)}\``)
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
  escapeSqlTableId: jest.fn(() => "user_permissions")
}));

jest.mock("../../lib/permissionScope", () => ({
  normalizeActionScope: jest.fn((v) => {
    const s = String(v ?? "").trim().toLowerCase();
    if (s === "own" || s === "unit" || s === "all") return s;
    return "all";
  })
}));

const mysql = require("mysql2");
const pool = require("../../lib/db").default;
const { normalizeActionScope } = require("../../lib/permissionScope");
const { hasModulePermission, hasAnyModuleAccess, getScopeForAction } = require("../../lib/rbac");

// Checks who may view, create, edit, or delete records based on their permission row.
describe("rbac", () => {
  // Reset mocks and default stubs before each example runs.
  beforeEach(() => {
    jest.clearAllMocks();
  });

// Checks who may view, create, edit, or delete records based on their permission row.
  describe("hasModulePermission", () => {
    test("admin bypass: always true without DB lookup", async () => {
      await expect(hasModulePermission({ id: 1, role: 1 }, "employee_master", "view")).resolves.toBe(true);
      await expect(hasModulePermission({ id: 1, role: 1 }, "employee_master", "create")).resolves.toBe(true);
      await expect(hasModulePermission({ id: 1, role: 1 }, "employee_master", "edit")).resolves.toBe(true);
      await expect(hasModulePermission({ id: 1, role: 1 }, "employee_master", "delete")).resolves.toBe(true);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test("view permission: allowed true from DB flag", async () => {
      pool.query.mockResolvedValueOnce([[{ allowed: 1 }]]);
      await expect(hasModulePermission({ id: 10, role: 2 }, "employee_master", "view")).resolves.toBe(true);
    });

    test("create permission: allowed true from DB flag", async () => {
      pool.query.mockResolvedValueOnce([[{ allowed: 1 }]]);
      await expect(hasModulePermission({ id: 10, role: 2 }, "employee_master", "create")).resolves.toBe(true);
    });

    test("edit permission: allowed true from DB flag", async () => {
      pool.query.mockResolvedValueOnce([[{ allowed: 1 }]]);
      await expect(hasModulePermission({ id: 10, role: 2 }, "employee_master", "edit")).resolves.toBe(true);
    });

    test("delete permission: allowed true from DB flag", async () => {
      pool.query.mockResolvedValueOnce([[{ allowed: 1 }]]);
      await expect(hasModulePermission({ id: 10, role: 2 }, "employee_master", "delete")).resolves.toBe(true);
    });

    test("denied access path: DB allowed=0 returns false", async () => {
      pool.query.mockResolvedValueOnce([[{ allowed: 0 }]]);
      await expect(hasModulePermission({ id: 10, role: 2 }, "employee_master", "view")).resolves.toBe(false);
    });

    test("missing permission row returns false", async () => {
      pool.query.mockResolvedValueOnce([[]]);
      await expect(hasModulePermission({ id: 10, role: 2 }, "employee_master", "view")).resolves.toBe(false);
    });

    test("inactive user object (non-admin, no permission row) is denied", async () => {
      pool.query.mockResolvedValueOnce([[]]);
      await expect(
        hasModulePermission({ id: 10, role: 2, active: "No" }, "employee_master", "view")
      ).resolves.toBe(false);
    });

    test("invalid module name returns false when no DB row", async () => {
      pool.query.mockResolvedValueOnce([[]]);
      await expect(hasModulePermission({ id: 10, role: 2 }, "not_a_real_module", "view")).resolves.toBe(false);
    });

    test("invalid action returns false without hitting DB", async () => {
      await expect(hasModulePermission({ id: 10, role: 2 }, "employee_master", "publish")).resolves.toBe(false);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test("database failure handling: query error is propagated", async () => {
      pool.query.mockRejectedValueOnce(new Error("db down"));
      await expect(hasModulePermission({ id: 10, role: 2 }, "employee_master", "view")).rejects.toThrow("db down");
    });
  });

// Automated checks for: hasAnyModuleAccess.
  describe("hasAnyModuleAccess", () => {
    test("admin bypass: always true", async () => {
      await expect(hasAnyModuleAccess({ id: 1, role: 1 }, "employee_master")).resolves.toBe(true);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test("returns true when any_flag = 1", async () => {
      pool.query.mockResolvedValueOnce([[{ any_flag: 1 }]]);
      await expect(hasAnyModuleAccess({ id: 20, role: 2 }, "employee_master")).resolves.toBe(true);
    });

    test("returns false for missing row / no access", async () => {
      pool.query.mockResolvedValueOnce([[]]);
      await expect(hasAnyModuleAccess({ id: 20, role: 2 }, "employee_master")).resolves.toBe(false);
    });

    test("returns false for null user", async () => {
      await expect(hasAnyModuleAccess(null, "employee_master")).resolves.toBe(false);
      expect(pool.query).not.toHaveBeenCalled();
    });

    test("database failure handling: query error is propagated", async () => {
      pool.query.mockRejectedValueOnce(new Error("db fail"));
      await expect(hasAnyModuleAccess({ id: 20, role: 2 }, "employee_master")).rejects.toThrow("db fail");
    });
  });

// Automated checks for: getScopeForAction.
  describe("getScopeForAction", () => {
    test("admin bypass returns all", async () => {
      await expect(getScopeForAction({ id: 1, role: 1 }, "employee_master", "view")).resolves.toBe("all");
      expect(pool.query).not.toHaveBeenCalled();
    });

    test("view scope: returns normalized scope from DB", async () => {
      pool.query.mockResolvedValueOnce([[{ sc: " unit " }]]);
      await expect(getScopeForAction({ id: 30, role: 2 }, "employee_master", "view")).resolves.toBe("unit");
      expect(normalizeActionScope).toHaveBeenCalledWith(" unit ");
      expect(mysql.escapeId).toHaveBeenCalledWith("view_scope");
    });

    test("edit scope: returns normalized scope from DB", async () => {
      pool.query.mockResolvedValueOnce([[{ sc: "own" }]]);
      await expect(getScopeForAction({ id: 30, role: 2 }, "employee_master", "edit")).resolves.toBe("own");
      expect(mysql.escapeId).toHaveBeenCalledWith("edit_scope");
    });

    test("delete scope: returns normalized scope from DB", async () => {
      pool.query.mockResolvedValueOnce([[{ sc: "all" }]]);
      await expect(getScopeForAction({ id: 30, role: 2 }, "employee_master", "delete")).resolves.toBe("all");
      expect(mysql.escapeId).toHaveBeenCalledWith("delete_scope");
    });

    test("missing permission row defaults to all", async () => {
      pool.query.mockResolvedValueOnce([[]]);
      await expect(getScopeForAction({ id: 30, role: 2 }, "employee_master", "view")).resolves.toBe("all");
    });

    test("invalid module with no row defaults to all", async () => {
      pool.query.mockResolvedValueOnce([[]]);
      await expect(getScopeForAction({ id: 30, role: 2 }, "unknown_module", "view")).resolves.toBe("all");
    });

    test("invalid action defaults to all without DB call", async () => {
      await expect(getScopeForAction({ id: 30, role: 2 }, "employee_master", "create")).resolves.toBe("all");
      expect(pool.query).not.toHaveBeenCalled();
    });

    test("null user defaults to all", async () => {
      await expect(getScopeForAction(null, "employee_master", "view")).resolves.toBe("all");
      expect(pool.query).not.toHaveBeenCalled();
    });

    test("database failure handling: query error is propagated", async () => {
      pool.query.mockRejectedValueOnce(new Error("scope query failed"));
      await expect(getScopeForAction({ id: 30, role: 2 }, "employee_master", "view")).rejects.toThrow(
        "scope query failed"
      );
    });
  });
});


