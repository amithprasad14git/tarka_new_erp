// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `api.crud.module.route`.
 * Run with: npm test
 */

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
  getSessionUser: jest.fn(),
  getSessionInvalidReason: jest.fn()
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

const pool = require("../../lib/db").default;
const { getSessionUser, getSessionInvalidReason } = require("../../lib/session");
const { hasModulePermission } = require("../../lib/rbac");
const { createCrudRecord } = require("../../lib/services/crud.service");
const { GET, POST } = require("../../app/api/(platform)/crud/[module]/route");

function mockReq(url, cookieHeader = "session=sid-crud") {
  return {
    url,
    headers: {
      get: (name) => (String(name).toLowerCase() === "cookie" ? cookieHeader : null)
    }
  };
}

describe("api/crud/[module] route", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    getSessionInvalidReason.mockResolvedValue("missing");
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test("GET returns 401 when session missing", async () => {
    getSessionUser.mockResolvedValue(null);
    const req = mockReq("http://localhost/api/crud/sample_module", "");
    const res = await GET(req, { params: Promise.resolve({ module: "sample_module" }) });
    expect(res.status).toBe(401);
  });

  test("GET returns 404 for unknown module", async () => {
    getSessionUser.mockResolvedValue({ id: 1, role: 1 });
    const req = mockReq("http://localhost/api/crud/unknown");
    const res = await GET(req, { params: Promise.resolve({ module: "unknown" }) });
    expect(res.status).toBe(404);
  });

  test("GET returns paged data and meta", async () => {
    getSessionUser.mockResolvedValue({ id: 1, role: 1 });
    hasModulePermission.mockResolvedValue(true);
    pool.query
      .mockResolvedValueOnce([[{ total: 1 }]])
      .mockResolvedValueOnce([[{ id: 1, name: "A" }]]);

    const req = mockReq("http://localhost/api/crud/sample_module?page=1&limit=20");
    const res = await GET(req, { params: Promise.resolve({ module: "sample_module" }) });
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.data).toEqual([{ id: 1, name: "A" }]);
    expect(payload.meta.total).toBe(1);
    expect(getSessionUser).toHaveBeenCalledWith("sid-crud");
  });

  test("GET lookup supports exclude_id filter", async () => {
    getSessionUser.mockResolvedValue({ id: 1, role: 1 });
    hasModulePermission.mockResolvedValue(true);
    pool.query
      .mockResolvedValueOnce([[{ total: 0 }]])
      .mockResolvedValueOnce([[]]);

    const req = mockReq(
      "http://localhost/api/crud/sample_module?lov=1&exclude_id=77&page=1&limit=20"
    );
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

    const req = mockReq("http://localhost/api/crud/sample_module?lov=1&f_unit=5&page=1&limit=20");
    const res = await GET(req, { params: Promise.resolve({ module: "sample_module" }) });
    expect(res.status).toBe(200);
    const countCall = pool.query.mock.calls[0];
    expect(String(countCall[0])).toContain("`unit` = ?");
    expect(countCall[1]).toEqual([5]);
  });

  test("POST returns 401 when session missing", async () => {
    getSessionUser.mockResolvedValue(null);
    const res = await POST(
      { ...mockReq("http://localhost/api/crud/sample_module", ""), json: jest.fn() },
      { params: Promise.resolve({ module: "sample_module" }) }
    );
    expect(res.status).toBe(401);
  });

  test("POST delegates to createCrudRecord", async () => {
    getSessionUser.mockResolvedValue({ id: 1 });
    createCrudRecord.mockResolvedValue({ status: 200, body: { ok: true, id: 10 } });
    const req = {
      ...mockReq("http://localhost/api/crud/sample_module"),
      json: jest.fn().mockResolvedValue({ name: "X" })
    };
    const res = await POST(req, { params: Promise.resolve({ module: "sample_module" }) });
    expect(createCrudRecord).toHaveBeenCalledWith({ id: 1 }, "sample_module", { name: "X" });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, id: 10 });
  });

  test("GET returns layman error with hint when query fails", async () => {
    getSessionUser.mockResolvedValue({ id: 1, role: 1 });
    hasModulePermission.mockResolvedValue(true);
    pool.query.mockRejectedValueOnce(
      Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })
    );
    const req = mockReq("http://localhost/api/crud/sample_module?page=1&limit=20");
    const res = await GET(req, { params: Promise.resolve({ module: "sample_module" }) });
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: expect.stringContaining("could not load the list"),
      hint: expect.stringContaining("connection refused")
    });
  });
});

