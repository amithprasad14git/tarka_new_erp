// Test file for validating app behavior and regression safety.
// Keep module-specific business logic in lib/modules/<module> files.

jest.mock("next/headers", () => ({
  cookies: jest.fn()
}));

jest.mock("../../lib/session", () => ({
  getSessionUser: jest.fn()
}));

jest.mock("../../lib/services/crud.service", () => ({
  getCrudRecordById: jest.fn(),
  updateCrudRecord: jest.fn(),
  deleteCrudRecord: jest.fn()
}));

const { cookies } = require("next/headers");
const { getSessionUser } = require("../../lib/session");
const { getCrudRecordById, updateCrudRecord, deleteCrudRecord } = require("../../lib/services/crud.service");
const { GET, PUT, DELETE } = require("../../app/api/crud/[module]/[id]/route");

function makeReq(body) {
  return { json: jest.fn().mockResolvedValue(body) };
}

describe("api/crud/[module]/[id] route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cookies.mockResolvedValue({ get: jest.fn().mockReturnValue({ value: "sid-crud-id" }) });
  });

  test("GET returns 401 when session missing", async () => {
    getSessionUser.mockResolvedValue(null);
    const res = await GET({}, { params: Promise.resolve({ module: "x", id: "1" }) });
    expect(res.status).toBe(401);
  });

  test("GET delegates to service and returns service status/body", async () => {
    getSessionUser.mockResolvedValue({ id: 1 });
    getCrudRecordById.mockResolvedValue({ status: 200, body: { data: { id: 1 } } });
    const res = await GET({}, { params: Promise.resolve({ module: "x", id: "1" }) });
    expect(getCrudRecordById).toHaveBeenCalledWith({ id: 1 }, "x", "1");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: { id: 1 } });
  });

  test("PUT reads body via callback and returns service response", async () => {
    getSessionUser.mockResolvedValue({ id: 1 });
    updateCrudRecord.mockImplementation(async (_u, _m, _id, getRawBody) => {
      const body = await getRawBody();
      expect(body).toEqual({ a: 1 });
      return { status: 200, body: { ok: true } };
    });
    const res = await PUT(makeReq({ a: 1 }), { params: Promise.resolve({ module: "x", id: "2" }) });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  test("DELETE delegates to service", async () => {
    getSessionUser.mockResolvedValue({ id: 1 });
    deleteCrudRecord.mockResolvedValue({ status: 200, body: { ok: true } });
    const res = await DELETE({}, { params: Promise.resolve({ module: "x", id: "2" }) });
    expect(deleteCrudRecord).toHaveBeenCalledWith({ id: 1 }, "x", "2");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });
});

