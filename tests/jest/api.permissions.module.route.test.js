// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `api.permissions.module.route`.
 * Run with: npm test
 */

// Test file for validating app behavior and regression safety.
// Keep module-specific business logic in lib/modules/<module> files.

// Replace real database, auth, and Next.js pieces with fakes so tests run offline.
jest.mock("next/headers", () => ({
  cookies: jest.fn()
}));

jest.mock("../../config/modules", () => ({
  modules: {
    branch_master: { table: "branch_master" }
  }
}));

jest.mock("../../lib/session", () => {
  const { apiUserMessage } = require("../../lib/apiUserMessages");
  return {
    getSessionUser: jest.fn(),
    getSessionInvalidReason: jest.fn(),
    sessionErrorMessageForInvalidReason: (reason) =>
      reason === "replaced" ? apiUserMessage("sessionReplaced") : apiUserMessage("sessionExpired"),
    sessionLoginReasonForInvalid: (reason) => (reason === "replaced" ? "replaced" : "expired")
  };
});

jest.mock("../../lib/rbac", () => ({
  hasModulePermission: jest.fn()
}));

const { cookies } = require("next/headers");
const { getSessionUser, getSessionInvalidReason } = require("../../lib/session");
const { hasModulePermission } = require("../../lib/rbac");
const { apiUserMessage } = require("../../lib/apiUserMessages");
const { GET } = require("../../app/api/permissions/[module]/route");

// Checks who may view, create, edit, or delete records based on their permission row.
describe("api/permissions/[module] route", () => {
  // Reset mocks and default stubs before each example runs.
  beforeEach(() => {
    jest.clearAllMocks();
    cookies.mockResolvedValue({ get: jest.fn().mockReturnValue({ value: "sid-perm" }) });
  });

  test("returns 401 when session is missing", async () => {
    getSessionUser.mockResolvedValue(null);
    getSessionInvalidReason.mockResolvedValue("missing");
    const res = await GET({}, { params: Promise.resolve({ module: "branch_master" }) });
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: apiUserMessage("sessionExpired"),
      reason: "expired"
    });
  });

  test("returns 404 for unknown module", async () => {
    getSessionUser.mockResolvedValue({ id: 1, role: 2, unit: 3 });
    const res = await GET({}, { params: Promise.resolve({ module: "unknown" }) });
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Unknown module" });
  });

  test("returns permissions payload", async () => {
    getSessionUser.mockResolvedValue({ id: 1, role: 2, unit: 3 });
    hasModulePermission
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const res = await GET({}, { params: Promise.resolve({ module: "branch_master" }) });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      module: "branch_master",
      canView: true,
      canCreate: false,
      canEdit: true,
      canDelete: false,
      role: 2,
      unit: 3
    });
  });
});


