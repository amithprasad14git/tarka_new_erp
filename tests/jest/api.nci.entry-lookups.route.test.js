// Test file for validating app behavior and regression safety.
// Keep module-specific business logic in lib/modules/<module> files.

jest.mock("next/headers", () => ({
  cookies: jest.fn()
}));

jest.mock("../../lib/session", () => ({
  getSessionUser: jest.fn()
}));

jest.mock("../../lib/rbac", () => ({
  hasModulePermission: jest.fn()
}));

jest.mock("../../lib/db", () => {
  const query = jest.fn();
  return {
    __esModule: true,
    default: { query },
    queryWithRetry: (sql, values) => query(sql, values)
  };
});

jest.mock("../../config/modules", () => ({
  modules: {
    new_case_inward: {
      fields: [
        {
          name: "branch",
          type: "lookup",
          lookup: { module: "branch_master", valueField: "id", labelField: "branchName" }
        },
        {
          name: "unit",
          type: "lookup",
          lookup: { module: "unit_master", valueField: "id", labelField: "unit" }
        },
        {
          name: "receivedFrom",
          type: "lookup",
          lookup: {
            module: "lookup_value_master",
            valueField: "id",
            labelField: "lookupValue",
            filterLookupTypeName: "Case Received From"
          }
        }
      ]
    },
    branch_master: { table: "branch_master" },
    unit_master: { table: "unit_master" },
    lookup_value_master: { table: "lookup_value_master" },
    lookup_type_master: { table: "lookup_type_master" }
  }
}));

jest.mock("../../lib/sqlModuleTable", () => ({
  escapeSqlTableIdForModuleConfig: jest.fn((cfg) => `\`${cfg.table}\``)
}));

jest.mock("../../lib/lookupLabelField", () => ({
  resolveLookupDisplayParts: jest.fn((lookup) => [lookup?.labelField || "id"])
}));

jest.mock("../../lib/lookupLabelFieldSql", () => ({
  buildLookupLabelSqlExpression: jest.fn(() => "CONCAT('', id)")
}));

const { cookies } = require("next/headers");
const pool = require("../../lib/db").default;
const { getSessionUser } = require("../../lib/session");
const { hasModulePermission } = require("../../lib/rbac");
const { GET } = require("../../app/api/new-case-inward/entry-lookups/route");

describe("api/new-case-inward/entry-lookups route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cookies.mockResolvedValue({ get: jest.fn().mockReturnValue({ value: "sid-nci" }) });
  });

  test("returns 401 for unauthenticated user", async () => {
    getSessionUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  test("returns lookup data for authorized user", async () => {
    getSessionUser.mockResolvedValue({ id: 7, role: 2 });
    hasModulePermission
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false);
    pool.query
      .mockResolvedValueOnce([[{ vf: 1, lf: "A Branch" }]])
      .mockResolvedValueOnce([[{ vf: 3, lf: "Unit 3" }]])
      .mockResolvedValueOnce([[{ vf: 99, lf: "Branch Office" }]]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body?.data?.branch).toEqual([{ id: 1, _label: "A Branch" }]);
    expect(body?.data?.unit).toEqual([{ id: 3, _label: "Unit 3" }]);
    expect(body?.data?.receivedFrom).toEqual([{ id: 99, _label: "Branch Office" }]);
    const lookupValueQuerySql = String(pool.query.mock.calls[2][0]);
    const lookupValueQueryParams = pool.query.mock.calls[2][1];
    expect(lookupValueQuerySql).toContain("lookup_type_master");
    expect(lookupValueQueryParams).toEqual(["Case Received From"]);
  });
});

