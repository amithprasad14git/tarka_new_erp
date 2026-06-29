/**
 * API tests for GET /api/return-case/return-reasons
 *
 * Preload reasons for Return Case details — authorized via return_case, not case_return_reasons.
 */
jest.mock("next/headers", () => ({
  cookies: jest.fn()
}));

jest.mock("../../lib/session", () => ({
  getSessionUser: jest.fn()
}));

jest.mock("../../lib/rbac", () => ({
  hasModulePermission: jest.fn()
}));

jest.mock("../../lib/db", () => ({
  __esModule: true,
  default: {
    getConnection: jest.fn()
  }
}));

jest.mock("../../lib/modules/returnCase", () => ({
  loadActiveReturnReasonsForPreload: jest.fn()
}));

const { cookies } = require("next/headers");
const { getSessionUser } = require("../../lib/session");
const { hasModulePermission } = require("../../lib/rbac");
const pool = require("../../lib/db").default;
const { loadActiveReturnReasonsForPreload } = require("../../lib/modules/returnCase");
const { GET } = require("../../app/api/return-case/return-reasons/route");

function mockReturnCasePermissions({ view = false, create = false, edit = false } = {}) {
  hasModulePermission.mockImplementation(async (_user, moduleKey, action) => {
    if (moduleKey !== "return_case") return false;
    if (action === "view") return view;
    if (action === "create") return create;
    if (action === "edit") return edit;
    return false;
  });
}

describe("api/return-case/return-reasons route", () => {
  const mockConn = { release: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    cookies.mockResolvedValue({ get: () => ({ value: "sid" }) });
    getSessionUser.mockResolvedValue({ id: 10, role: 2 });
    mockReturnCasePermissions({ view: false, create: true, edit: false });
    pool.getConnection.mockResolvedValue(mockConn);
    loadActiveReturnReasonsForPreload.mockResolvedValue({
      data: [
        { returnReason: "Borrower mismatch", sequence: 1 },
        { returnReason: "Documents incomplete", sequence: 2 }
      ]
    });
  });

  test("returns 401 when not logged in", async () => {
    getSessionUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(loadActiveReturnReasonsForPreload).not.toHaveBeenCalled();
  });

  test("returns 403 without return_case view, create, or edit", async () => {
    mockReturnCasePermissions({ view: false, create: false, edit: false });
    const res = await GET();
    expect(res.status).toBe(403);
    expect(loadActiveReturnReasonsForPreload).not.toHaveBeenCalled();
  });

  test("returns active reasons when user has return_case create only", async () => {
    mockReturnCasePermissions({ view: false, create: true, edit: false });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      data: [
        { returnReason: "Borrower mismatch", sequence: 1 },
        { returnReason: "Documents incomplete", sequence: 2 }
      ]
    });
    expect(loadActiveReturnReasonsForPreload).toHaveBeenCalledWith(mockConn);
    expect(mockConn.release).toHaveBeenCalled();
    expect(hasModulePermission).not.toHaveBeenCalledWith(expect.anything(), "case_return_reasons", expect.anything());
  });

  test("returns active reasons when user has return_case view", async () => {
    mockReturnCasePermissions({ view: true, create: false, edit: false });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data[0]).toHaveProperty("returnReason");
  });
});
