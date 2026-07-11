// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `api.nci.transaction-control.route`.
 * Run with: npm test
 */

// Test file for validating app behavior and regression safety.
// Keep module-specific business logic in lib/modules/<module> files.

// Replace real database, auth, and Next.js pieces with fakes so tests run offline.
jest.mock("next/headers", () => ({
  cookies: jest.fn()
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

jest.mock("../../lib/db", () => {
  const query = jest.fn();
  return {
    __esModule: true,
    default: { query },
    queryWithRetry: (sql, values) => query(sql, values)
  };
});

jest.mock("../../lib/sqlModuleTable", () => ({
  escapeSqlTableIdForModuleConfig: jest.fn(() => "`new_case_inward_transaction_control`")
}));

const { cookies } = require("next/headers");
const { getSessionUser, getSessionInvalidReason } = require("../../lib/session");
const pool = require("../../lib/db").default;
const { apiUserMessage } = require("../../lib/apiUserMessages");
const { GET } = require("../../app/api/(cases)/new-case-inward/transaction-control/route");

// Automated checks for: api/new-case-inward/transaction-control route.
describe("api/new-case-inward/transaction-control route", () => {
  let consoleErrorSpy;

  // Reset mocks and default stubs before each example runs.
  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    cookies.mockResolvedValue({ get: jest.fn().mockReturnValue({ value: "sid-nci" }) });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test("returns 401 when session is missing", async () => {
    getSessionUser.mockResolvedValue(null);
    getSessionInvalidReason.mockResolvedValue("missing");
    const res = await GET();
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: apiUserMessage("sessionExpired"),
      reason: "expired"
    });
  });

  test("returns active control rows", async () => {
    getSessionUser.mockResolvedValue({ id: 10 });
    const rows = [{ id: 5, field_name: "Entrustment Date", allow_flag: "No", days: 7 }];
    pool.query.mockResolvedValueOnce([rows]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE is_active = 1")
    );
    await expect(res.json()).resolves.toEqual({ data: rows });
  });

  test("returns 500 when query fails", async () => {
    getSessionUser.mockResolvedValue({ id: 10 });
    pool.query.mockRejectedValueOnce(
      Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" })
    );
    const res = await GET();
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: "We could not load transaction control settings. The server could not connect to the database. Please contact your administrator.",
      hint: expect.stringContaining("connection refused")
    });
  });
});



