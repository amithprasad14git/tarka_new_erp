// Test file for validating app behavior and regression safety.
// Keep module-specific business logic in lib/modules/<module> files.

jest.mock("next/headers", () => ({
  cookies: jest.fn()
}));

jest.mock("../../config/modules", () => ({
  modules: {
    sample_module: {
      table: "sample_module",
      fields: [
        { name: "name", type: "text" },
        { name: "unit", type: "lookup", lookup: { module: "unit_master", valueField: "id" } }
      ]
    },
    lookup_value_master: {
      table: "lookup_value_master",
      fields: [{ name: "lookupType", type: "lookup" }]
    },
    lookup_type_master: {
      table: "lookup_type_master",
      fields: [{ name: "lookupType", type: "text" }]
    },
    unit_master: {
      table: "unit_master",
      fields: [{ name: "unit", type: "text" }]
    }
  }
}));

jest.mock("../../lib/db", () => {
  const query = jest.fn();
  return {
    __esModule: true,
    default: {
      query,
      getConnection: jest.fn()
    },
    queryWithRetry: (sql, values) => query(sql, values)
  };
});

jest.mock("../../lib/session", () => ({
  getSessionUser: jest.fn()
}));

jest.mock("../../lib/rbac", () => ({
  hasModulePermission: jest.fn(),
  getScopeForAction: jest.fn()
}));

jest.mock("../../lib/rowScope", () => ({
  appendRowScopeFilter: jest.fn(),
  annotateRowsModifyAccess: jest.fn()
}));

jest.mock("../../lib/crudLookupEnrich", () => ({
  enrichLookupDisplayRows: jest.fn()
}));

jest.mock("../../lib/crudListSelect", () => ({
  buildListOrderByExpr: jest.fn(() => "`id`"),
  buildListSelectClause: jest.fn(() => "*")
}));

jest.mock("../../lib/crudListSearch", () => ({
  appendGlobalSearchClause: jest.fn(),
  appendLookupFkFilter: jest.fn()
}));

jest.mock("../../lib/sqlModuleTable", () => ({
  escapeSqlTableIdForModuleConfig: jest.fn(() => "`sample_module`")
}));

jest.mock("../../lib/services/crud.service", () => ({
  createCrudRecord: jest.fn()
}));

jest.mock("../../lib/lookupLovAccess", () => ({
  canAccessLovViaReferencingModule: jest.fn()
}));

jest.mock("../../lib/modules/newCaseInward", () => ({
  applyRole2FinalStageEditLock: jest.fn()
}));

const { cookies } = require("next/headers");
const pool = require("../../lib/db").default;
const { getSessionUser } = require("../../lib/session");
const { hasModulePermission } = require("../../lib/rbac");
const { createCrudRecord } = require("../../lib/services/crud.service");
const { GET, POST } = require("../../app/api/crud/[module]/route");

describe("api/crud/[module] route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cookies.mockResolvedValue({ get: jest.fn().mockReturnValue({ value: "sid-crud" }) });
  });

  test("GET returns 401 when session missing", async () => {
    getSessionUser.mockResolvedValue(null);
    const req = { url: "http://localhost/api/crud/sample_module" };
    const res = await GET(req, { params: Promise.resolve({ module: "sample_module" }) });
    expect(res.status).toBe(401);
  });

  test("GET returns 404 for unknown module", async () => {
    getSessionUser.mockResolvedValue({ id: 1, role: 1 });
    const req = { url: "http://localhost/api/crud/unknown" };
    const res = await GET(req, { params: Promise.resolve({ module: "unknown" }) });
    expect(res.status).toBe(404);
  });

  test("GET returns paged data and meta", async () => {
    getSessionUser.mockResolvedValue({ id: 1, role: 1 });
    hasModulePermission.mockResolvedValue(true);
    pool.query
      .mockResolvedValueOnce([[{ total: 1 }]])
      .mockResolvedValueOnce([[{ id: 1, name: "A" }]]);

    const req = { url: "http://localhost/api/crud/sample_module?page=1&limit=20" };
    const res = await GET(req, { params: Promise.resolve({ module: "sample_module" }) });
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.data).toEqual([{ id: 1, name: "A" }]);
    expect(payload.meta.total).toBe(1);
  });

  test("GET lookup supports exclude_id filter", async () => {
    getSessionUser.mockResolvedValue({ id: 1, role: 1 });
    hasModulePermission.mockResolvedValue(true);
    pool.query
      .mockResolvedValueOnce([[{ total: 0 }]])
      .mockResolvedValueOnce([[]]);

    const req = { url: "http://localhost/api/crud/sample_module?lov=1&exclude_id=77&page=1&limit=20" };
    const res = await GET(req, { params: Promise.resolve({ module: "sample_module" }) });
    expect(res.status).toBe(200);
    const countCall = pool.query.mock.calls[0];
    expect(String(countCall[0])).toContain("`id` <> ?");
    expect(countCall[1]).toEqual([77]);
  });

  test("GET lookup supports exact numeric lookup filter (f_unit)", async () => {
    getSessionUser.mockResolvedValue({ id: 1, role: 1 });
    hasModulePermission.mockResolvedValue(true);
    pool.query
      .mockResolvedValueOnce([[{ total: 0 }]])
      .mockResolvedValueOnce([[]]);

    const req = { url: "http://localhost/api/crud/sample_module?lov=1&f_unit=5&page=1&limit=20" };
    const res = await GET(req, { params: Promise.resolve({ module: "sample_module" }) });
    expect(res.status).toBe(200);
    const countCall = pool.query.mock.calls[0];
    expect(String(countCall[0])).toContain("`unit` = ?");
    expect(countCall[1]).toEqual([5]);
  });

  test("POST returns 401 when session missing", async () => {
    getSessionUser.mockResolvedValue(null);
    const res = await POST({ json: jest.fn() }, { params: Promise.resolve({ module: "sample_module" }) });
    expect(res.status).toBe(401);
  });

  test("POST delegates to createCrudRecord", async () => {
    getSessionUser.mockResolvedValue({ id: 1 });
    createCrudRecord.mockResolvedValue({ status: 200, body: { ok: true, id: 10 } });
    const req = { json: jest.fn().mockResolvedValue({ name: "X" }) };
    const res = await POST(req, { params: Promise.resolve({ module: "sample_module" }) });
    expect(createCrudRecord).toHaveBeenCalledWith({ id: 1 }, "sample_module", { name: "X" });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, id: 10 });
  });
});

