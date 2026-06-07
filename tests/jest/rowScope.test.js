// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `rowScope`.
 * Run with: npm test
 */

// Test file for validating app behavior and regression safety.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Comprehensive tests for lib/rowScope.js
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
  escapeSqlTableId: jest.fn((t) => `\`${String(t)}\``)
}));

jest.mock("../../lib/crudRecordAudit", () => ({
  getAuditColumnNames: jest.fn(() => ({
    createdBy: "createdBy",
    createdAt: "createdDate",
    modifiedBy: "modifiedBy",
    modifiedAt: "modifiedDate"
  }))
}));

jest.mock("../../lib/rbac", () => ({
  getScopeForAction: jest.fn()
}));

const pool = require("../../lib/db").default;
const { getScopeForAction } = require("../../lib/rbac");
const {
  normalizeDataScope,
  appendRowScopeFilter,
  rowMatchesScope,
  annotateRowsModifyAccess,
  canUserModifyRow
} = require("../../lib/rowScope");

const moduleCfg = {
  table: "new_case_inward",
  fields: [{ name: "id" }, { name: "createdBy" }]
};

// Automated checks for: rowScope.
describe("rowScope", () => {
  // Reset mocks and default stubs before each example runs.
  beforeEach(() => {
    jest.clearAllMocks();
  });

// Checks incoming form data is cleaned and rejected when rules are broken.
  describe("normalizeDataScope", () => {
    test("normalizes own, unit, all and defaults invalid to all", () => {
      expect(normalizeDataScope("own")).toBe("own");
      expect(normalizeDataScope(" UNIT ")).toBe("unit");
      expect(normalizeDataScope("all")).toBe("all");
      expect(normalizeDataScope("bad-value")).toBe("all");
      expect(normalizeDataScope(null)).toBe("all");
    });
  });

// Checks list search and column filters build safe SQL and match the right rows.
  describe("appendRowScopeFilter", () => {
    test("all scope adds no filter", () => {
      const whereParts = [];
      const whereValues = [];
      appendRowScopeFilter(moduleCfg, { id: 9, role: 2, unit: 7 }, "all", whereParts, whereValues);
      expect(whereParts).toEqual([]);
      expect(whereValues).toEqual([]);
    });

    test("admin bypass adds no filter", () => {
      const whereParts = [];
      const whereValues = [];
      appendRowScopeFilter(moduleCfg, { id: 1, role: 1, unit: 7 }, "own", whereParts, whereValues);
      expect(whereParts).toEqual([]);
      expect(whereValues).toEqual([]);
    });

    test("own scope filters by createdBy", () => {
      const whereParts = [];
      const whereValues = [];
      appendRowScopeFilter(moduleCfg, { id: 9, role: 2 }, "own", whereParts, whereValues);
      expect(whereParts).toEqual(["`createdBy` = ?"]);
      expect(whereValues).toEqual([9]);
    });

    test("own scope on users table allows id or createdBy", () => {
      const whereParts = [];
      const whereValues = [];
      appendRowScopeFilter({ ...moduleCfg, table: "users" }, { id: 9, role: 2 }, "own", whereParts, whereValues);
      expect(whereParts).toEqual(["(`id` = ? OR `createdBy` = ?)"]);
      expect(whereValues).toEqual([9, 9]);
    });

    test("unit scope filters rows by creator unit", () => {
      const whereParts = [];
      const whereValues = [];
      appendRowScopeFilter(moduleCfg, { id: 9, role: 2, unit: 5 }, "unit", whereParts, whereValues);
      expect(whereParts[0]).toContain("IN (SELECT `id` FROM `users` WHERE `unit` = ?)");
      expect(whereValues).toEqual([5]);
    });

    test("unit scope with missing user unit denies all rows", () => {
      const whereParts = [];
      const whereValues = [];
      appendRowScopeFilter(moduleCfg, { id: 9, role: 2, unit: "" }, "unit", whereParts, whereValues);
      expect(whereParts).toEqual(["1=0"]);
      expect(whereValues).toEqual([]);
    });

    test("unit scope with missing createdBy field denies all rows", () => {
      const cfgNoCreatedBy = { table: "x_table", fields: [{ name: "id" }] };
      const whereParts = [];
      const whereValues = [];
      appendRowScopeFilter(cfgNoCreatedBy, { id: 9, role: 2, unit: 5 }, "unit", whereParts, whereValues);
      expect(whereParts).toEqual(["1=0"]);
      expect(whereValues).toEqual([]);
    });
  });

// Automated checks for: rowMatchesScope.
  describe("rowMatchesScope", () => {
    test("all scope and admin bypass allow access", async () => {
      await expect(rowMatchesScope(moduleCfg, { id: 7, role: 2 }, "all", { createdBy: 99 })).resolves.toBe(true);
      await expect(rowMatchesScope(moduleCfg, { id: 7, role: 1 }, "own", { createdBy: 99 })).resolves.toBe(true);
    });

    test("own scope allows own row and denies ownership mismatch", async () => {
      await expect(rowMatchesScope(moduleCfg, { id: 7, role: 2 }, "own", { createdBy: 7 })).resolves.toBe(true);
      await expect(rowMatchesScope(moduleCfg, { id: 7, role: 2 }, "own", { createdBy: 8 })).resolves.toBe(false);
    });

    test("own scope users table allows own id even if createdBy differs", async () => {
      const cfg = { ...moduleCfg, table: "users" };
      await expect(rowMatchesScope(cfg, { id: 7, role: 2 }, "own", { id: 7, createdBy: 11 })).resolves.toBe(true);
      await expect(rowMatchesScope(cfg, { id: 7, role: 2 }, "own", { id: 8, createdBy: 7 })).resolves.toBe(true);
      await expect(rowMatchesScope(cfg, { id: 7, role: 2 }, "own", { id: 8, createdBy: 9 })).resolves.toBe(false);
    });

    test("unit scope allows same creator unit and denies mismatch", async () => {
      pool.query.mockResolvedValueOnce([[{ unit: 5 }]]);
      await expect(rowMatchesScope(moduleCfg, { id: 7, role: 2, unit: 5 }, "unit", { createdBy: 99 })).resolves.toBe(
        true
      );

      pool.query.mockResolvedValueOnce([[{ unit: 6 }]]);
      await expect(rowMatchesScope(moduleCfg, { id: 7, role: 2, unit: 5 }, "unit", { createdBy: 99 })).resolves.toBe(
        false
      );
    });

    test("unit scope denied for missing session/user unit", async () => {
      await expect(rowMatchesScope(moduleCfg, { id: 7, role: 2, unit: "" }, "unit", { createdBy: 99 })).resolves.toBe(
        false
      );
      await expect(rowMatchesScope(moduleCfg, null, "unit", { createdBy: 99 })).resolves.toBe(false);
    });

    test("invalid scope value defaults to allow (all)", async () => {
      await expect(rowMatchesScope(moduleCfg, { id: 7, role: 2 }, "nonsense", { createdBy: 99 })).resolves.toBe(true);
    });

    test("database error handling: unit creator-unit query rejection is propagated", async () => {
      pool.query.mockRejectedValueOnce(new Error("unit query failed"));
      await expect(
        rowMatchesScope(moduleCfg, { id: 7, role: 2, unit: 5 }, "unit", { createdBy: 99 })
      ).rejects.toThrow("unit query failed");
    });
  });

// Automated checks for: annotateRowsModifyAccess.
  describe("annotateRowsModifyAccess", () => {
    test("admin bypass marks all rows editable/deletable", async () => {
      const rows = [{ id: 1 }, { id: 2 }];
      await annotateRowsModifyAccess("new_case_inward", moduleCfg, { id: 1, role: 1 }, rows, {
        canEdit: false,
        canDelete: false
      });
      expect(rows).toEqual([
        { id: 1, _canEdit: true, _canDelete: true },
        { id: 2, _canEdit: true, _canDelete: true }
      ]);
    });

    test("applies own/unit/all scopes and flags", async () => {
      const rows = [
        { id: 1, createdBy: 10 },
        { id: 2, createdBy: 11 },
        { id: 3, createdBy: 12 }
      ];

      getScopeForAction
        .mockResolvedValueOnce("own") // edit scope
        .mockResolvedValueOnce("unit"); // delete scope

      pool.query.mockResolvedValueOnce([[{ id: 10, unit: 5 }, { id: 11, unit: 6 }, { id: 12, unit: 5 }]]);

      await annotateRowsModifyAccess("new_case_inward", moduleCfg, { id: 10, role: 2, unit: 5 }, rows, {
        canEdit: true,
        canDelete: true
      });

      expect(rows).toEqual([
        { id: 1, createdBy: 10, _canEdit: true, _canDelete: true },
        { id: 2, createdBy: 11, _canEdit: false, _canDelete: false },
        { id: 3, createdBy: 12, _canEdit: false, _canDelete: true }
      ]);
    });

    test("denied access path when role flags are false", async () => {
      const rows = [{ id: 1, createdBy: 10 }];
      getScopeForAction.mockResolvedValueOnce("all").mockResolvedValueOnce("all");
      await annotateRowsModifyAccess("new_case_inward", moduleCfg, { id: 10, role: 2, unit: 5 }, rows, {
        canEdit: false,
        canDelete: false
      });
      expect(rows[0]._canEdit).toBe(false);
      expect(rows[0]._canDelete).toBe(false);
    });

    test("database error handling: batch unit lookup failure is propagated", async () => {
      const rows = [{ id: 1, createdBy: 10 }];
      getScopeForAction.mockResolvedValueOnce("unit").mockResolvedValueOnce("all");
      pool.query.mockRejectedValueOnce(new Error("batch unit lookup failed"));

      await expect(
        annotateRowsModifyAccess("new_case_inward", moduleCfg, { id: 10, role: 2, unit: 5 }, rows, {
          canEdit: true,
          canDelete: false
        })
      ).rejects.toThrow("batch unit lookup failed");
    });

    test("users table own-scope special-case marks own id editable", async () => {
      const rows = [{ id: 7, createdBy: 11 }, { id: 8, createdBy: 7 }, { id: 9, createdBy: 10 }];
      const usersCfg = { table: "users", fields: [{ name: "id" }, { name: "createdBy" }] };
      getScopeForAction.mockResolvedValueOnce("own").mockResolvedValueOnce("nonsense");

      await annotateRowsModifyAccess("users", usersCfg, { id: 7, role: 2, unit: 5 }, rows, {
        canEdit: true,
        canDelete: true
      });

      expect(rows[0]._canEdit).toBe(true);
      expect(rows[1]._canEdit).toBe(true);
      expect(rows[2]._canEdit).toBe(false);
      expect(rows[0]._canDelete).toBe(true);
      expect(rows[1]._canDelete).toBe(true);
      expect(rows[2]._canDelete).toBe(true);
    });
  });

// Automated checks for: canUserModifyRow.
  describe("canUserModifyRow", () => {
    test("delegates to edit scope for update action", async () => {
      getScopeForAction.mockResolvedValueOnce("own");
      await expect(
        canUserModifyRow("new_case_inward", moduleCfg, { id: 5, role: 2 }, { createdBy: 5 }, "edit")
      ).resolves.toBe(true);
      expect(getScopeForAction).toHaveBeenCalledWith({ id: 5, role: 2 }, "new_case_inward", "edit");
    });

    test("delegates to delete scope for delete action and denies mismatch", async () => {
      getScopeForAction.mockResolvedValueOnce("own");
      await expect(
        canUserModifyRow("new_case_inward", moduleCfg, { id: 5, role: 2 }, { createdBy: 8 }, "delete")
      ).resolves.toBe(false);
      expect(getScopeForAction).toHaveBeenCalledWith({ id: 5, role: 2 }, "new_case_inward", "delete");
    });
  });
});


