// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `sqlModuleTable`.
 * Run with: npm test
 */

// Test file for validating app behavior and regression safety.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Comprehensive tests for lib/sqlModuleTable.js
 */

// Replace real database, auth, and Next.js pieces with fakes so tests run offline.
jest.mock("mysql2", () => ({
  escapeId: jest.fn((v) => `\`${String(v)}\``)
}));

jest.mock("../../config/modules", () => ({
  modules: {
    employee_master: { table: "employee_master" },
    unit_master: { table: "unit_master" },
    new_case_inward: {
      table: "new_case_inward",
      childTables: [{ key: "amount_recovered", table: "new_case_inward_amount_recovered" }]
    }
  }
}));

const mysql = require("mysql2");
const {
  assertAllowedTableName,
  escapeSqlTableId,
  tableNameFromModuleKey,
  escapeSqlTableIdForModuleKey,
  tableNameFromModuleConfig,
  escapeSqlTableIdForModuleConfig
} = require("../../lib/sqlModuleTable");

// Automated checks for: sqlModuleTable.
describe("sqlModuleTable", () => {
  // Reset mocks and default stubs before each example runs.
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("valid module table resolution", () => {
    expect(tableNameFromModuleKey("employee_master")).toBe("employee_master");
    expect(tableNameFromModuleKey("unit_master")).toBe("unit_master");
  });

  test("valid child table resolution", () => {
    expect(assertAllowedTableName("new_case_inward_amount_recovered")).toBe("new_case_inward_amount_recovered");
  });

  test("invalid table rejection", () => {
    expect(() => assertAllowedTableName("not_a_table")).toThrow("Disallowed or unknown SQL table name");
  });

  test("SQL injection attempt rejection", () => {
    expect(() => assertAllowedTableName("users; DROP TABLE users;--")).toThrow("Disallowed or unknown SQL table name");
    expect(() => assertAllowedTableName("employee_master OR 1=1")).toThrow("Disallowed or unknown SQL table name");
  });

  test("empty table name rejection", () => {
    expect(() => assertAllowedTableName("")).toThrow("Disallowed or unknown SQL table name");
    expect(() => assertAllowedTableName("   ")).toThrow("Disallowed or unknown SQL table name");
  });

  test("null input rejection", () => {
    expect(() => assertAllowedTableName(null)).toThrow("Disallowed or unknown SQL table name");
  });

  test("undefined input rejection", () => {
    expect(() => assertAllowedTableName(undefined)).toThrow("Disallowed or unknown SQL table name");
  });

  test("escape helper wraps valid table with mysql.escapeId", () => {
    const out = escapeSqlTableId("employee_master");
    expect(out).toBe("`employee_master`");
    expect(mysql.escapeId).toHaveBeenCalledWith("employee_master");
  });

  test("module-key helper escapes valid module table", () => {
    const out = escapeSqlTableIdForModuleKey("unit_master");
    expect(out).toBe("`unit_master`");
    expect(mysql.escapeId).toHaveBeenCalledWith("unit_master");
  });

  test("module-key helper rejects unknown module", () => {
    expect(() => tableNameFromModuleKey("missing_module")).toThrow("Unknown module key");
  });

  test("module-config helper resolves and escapes valid config", () => {
    expect(tableNameFromModuleConfig({ table: "employee_master" })).toBe("employee_master");
    expect(escapeSqlTableIdForModuleConfig({ table: "employee_master" })).toBe("`employee_master`");
  });

  test("module-config helper rejects missing table", () => {
    expect(() => tableNameFromModuleConfig({})).toThrow("Module config missing table");
    expect(() => tableNameFromModuleConfig(null)).toThrow("Module config missing table");
  });
});


