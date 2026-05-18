// Test file for validating app behavior and regression safety.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Comprehensive tests for lib/crudListSearch.js
 */

jest.mock("mysql2", () => ({
  escapeId: jest.fn((v) => `\`${String(v)}\``)
}));

jest.mock("../../config/modules", () => ({
  modules: {
    users: { table: "users" },
    unit_master: { table: "unit_master" },
    lookup_value_master: { table: "lookup_value_master" },
    new_case_inward: { table: "new_case_inward" }
  }
}));

jest.mock("../../lib/sqlModuleTable", () => ({
  escapeSqlTableIdForModuleConfig: jest.fn((cfg) => `\`${cfg.table}\``)
}));

jest.mock("../../lib/lookupLabelField", () => ({
  getModuleGlobalSearchColumns: jest.fn(),
  getRefLookupSearchColumns: jest.fn()
}));

const mysql = require("mysql2");
const { getModuleGlobalSearchColumns, getRefLookupSearchColumns } = require("../../lib/lookupLabelField");
const { appendGlobalSearchClause, appendLookupFkFilter } = require("../../lib/crudListSearch");
const { escapeSqlLikePattern } = require("../../lib/sqlLikeEscape");

describe("crudListSearch.appendGlobalSearchClause", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("global search generation: single-column LIKE clause", () => {
    const whereParts = [];
    const whereValues = [];
    getModuleGlobalSearchColumns.mockReturnValueOnce(["fullName"]);

    appendGlobalSearchClause({ table: "users" }, "amit", whereParts, whereValues);

    expect(whereParts).toEqual(["`fullName` LIKE ?"]);
    expect(whereValues).toEqual(["%amit%"]);
  });

  test("global search generation: multi-column OR LIKE clause", () => {
    const whereParts = [];
    const whereValues = [];
    getModuleGlobalSearchColumns.mockReturnValueOnce(["fullName", "email"]);

    appendGlobalSearchClause({ table: "users" }, "amith", whereParts, whereValues);

    expect(whereParts).toEqual(["(`fullName` LIKE ? OR `email` LIKE ?)"]);
    expect(whereValues).toEqual(["%amith%", "%amith%"]);
  });

  test("empty search handling: no clause added", () => {
    const whereParts = [];
    const whereValues = [];
    appendGlobalSearchClause({ table: "users" }, "   ", whereParts, whereValues);
    expect(whereParts).toEqual([]);
    expect(whereValues).toEqual([]);
    expect(getModuleGlobalSearchColumns).not.toHaveBeenCalled();
  });

  test("invalid field rejection equivalent: no searchable columns => no clause", () => {
    const whereParts = [];
    const whereValues = [];
    getModuleGlobalSearchColumns.mockReturnValueOnce([]);
    appendGlobalSearchClause({ table: "users" }, "x", whereParts, whereValues);
    expect(whereParts).toEqual([]);
    expect(whereValues).toEqual([]);
  });

  test("injection-safe query generation for global search", () => {
    const whereParts = [];
    const whereValues = [];
    const payload = "a%' OR 1=1 --";
    getModuleGlobalSearchColumns.mockReturnValueOnce(["email"]);

    appendGlobalSearchClause({ table: "users" }, payload, whereParts, whereValues);
    expect(whereParts[0]).toBe("`email` LIKE ?");
    expect(whereValues[0]).toBe(`%${payload}%`);
    expect(whereParts[0]).not.toContain(payload);
    expect(mysql.escapeId).toHaveBeenCalledWith("email");
  });
});

describe("crudListSearch.appendLookupFkFilter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("field-specific search: single lookup search column", () => {
    const whereParts = [];
    const whereValues = [];
    getRefLookupSearchColumns.mockReturnValueOnce(["unitName"]);

    appendLookupFkFilter(
      "unit",
      { lookup: { module: "unit_master", valueField: "id" } },
      "north",
      whereParts,
      whereValues
    );

    expect(whereParts).toEqual(["`unit` IN (SELECT `id` FROM `unit_master` WHERE `unitName` LIKE ?)"]);
    expect(whereValues).toEqual(["%north%"]);
  });

  test("lookup filtering: multiple search columns produce OR subquery", () => {
    const whereParts = [];
    const whereValues = [];
    getRefLookupSearchColumns.mockReturnValueOnce(["code", "name"]);

    appendLookupFkFilter(
      "branch",
      { lookup: { module: "unit_master", valueField: "id" } },
      "hub",
      whereParts,
      whereValues
    );

    expect(whereParts).toEqual([
      "`branch` IN (SELECT `id` FROM `unit_master` WHERE (`code` LIKE ? OR `name` LIKE ?))"
    ]);
    expect(whereValues).toEqual(["%hub%", "%hub%"]);
  });

  test("strips user-supplied % wildcards before wrapping", () => {
    const whereParts = [];
    const whereValues = [];
    getRefLookupSearchColumns.mockReturnValueOnce(["caseNo"]);

    appendLookupFkFilter(
      "caseNo",
      { lookup: { module: "new_case_inward", valueField: "id" } },
      "%10011",
      whereParts,
      whereValues
    );

    expect(whereValues).toEqual(["%10011%"]);
  });

  test("empty search handling for lookup filter", () => {
    const whereParts = [];
    const whereValues = [];
    appendLookupFkFilter(
      "unit",
      { lookup: { module: "unit_master", valueField: "id" } },
      "   ",
      whereParts,
      whereValues
    );
    expect(whereParts).toEqual([]);
    expect(whereValues).toEqual([]);
  });

  test("invalid field rejection: missing lookup config results in no clause", () => {
    const whereParts = [];
    const whereValues = [];
    appendLookupFkFilter("unit", {}, "north", whereParts, whereValues);
    expect(whereParts).toEqual([]);
    expect(whereValues).toEqual([]);
  });

  test("invalid module fallback: unknown lookup module results in no clause", () => {
    const whereParts = [];
    const whereValues = [];
    appendLookupFkFilter(
      "unit",
      { lookup: { module: "unknown_module", valueField: "id" } },
      "north",
      whereParts,
      whereValues
    );
    expect(whereParts).toEqual([]);
    expect(whereValues).toEqual([]);
  });

  test("injection-safe query generation for lookup filter", () => {
    const whereParts = [];
    const whereValues = [];
    const payload = "%' OR 1=1 --";
    getRefLookupSearchColumns.mockReturnValueOnce(["lookupValue"]);

    appendLookupFkFilter(
      "lookupType",
      { lookup: { module: "lookup_value_master", valueField: "id" } },
      payload,
      whereParts,
      whereValues
    );

    expect(whereParts[0]).toBe("`lookupType` IN (SELECT `id` FROM `lookup_value_master` WHERE `lookupValue` LIKE ?)");
    // appendLookupFkFilter strips leading/trailing % from user input, then wraps with % for LIKE.
    expect(whereValues[0]).toBe("%' OR 1=1 --%");
    expect(whereParts[0]).not.toContain(payload);
  });
});

describe("sqlLikeEscape helper usage expectations", () => {
  test("SQL LIKE escaping for date/text filter terms", () => {
    expect(escapeSqlLikePattern("100%_done\\x")).toBe("100\\%\\_done\\\\x");
  });
});

describe("not-applicable in this file", () => {
  test("numeric filtering and date filtering are handled by CRUD route type logic, not crudListSearch", () => {
    // This test documents scope boundaries: `crudListSearch.js` only builds global text search and lookup FK text filters.
    expect(true).toBe(true);
  });
});

