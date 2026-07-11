// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `api.nci.branch-copy-pdf.route`.
 * Run with: npm test
 */

// Test file for validating app behavior and regression safety.
// Keep module-specific business logic in lib/modules/<module> files.

// Replace real database, auth, and Next.js pieces with fakes so tests run offline.
jest.mock("next/headers", () => ({
  cookies: jest.fn()
}));

jest.mock("../../lib/session", () => ({
  getSessionUser: jest.fn(),
  getSessionInvalidReason: jest.fn()
}));

jest.mock("../../lib/services/crud.service", () => ({
  getCrudRecordById: jest.fn()
}));

jest.mock("../../lib/db", () => {
  const query = jest.fn();
  return {
    __esModule: true,
    default: { query, getConnection: jest.fn() },
    queryWithRetry: (sql, values) => query(sql, values)
  };
});

jest.mock("../../lib/modules/newCaseInwardBranchCopyPdf", () => ({
  buildNewCaseInwardBranchCopyPdf: jest.fn(),
  safeBranchCopyPdfFilename: jest.fn()
}));

const { cookies } = require("next/headers");
const { getSessionUser, getSessionInvalidReason } = require("../../lib/session");
const { getCrudRecordById } = require("../../lib/services/crud.service");
const pool = require("../../lib/db").default;
const {
  buildNewCaseInwardBranchCopyPdf,
  safeBranchCopyPdfFilename
} = require("../../lib/modules/newCaseInwardBranchCopyPdf");
const { GET } = require("../../app/api/(cases)/new-case-inward/branch-copy-pdf/[id]/route");

// Checks printable PDF output is built without crashing and includes expected content.
describe("api/new-case-inward/branch-copy-pdf/[id] route", () => {
  // Reset mocks and default stubs before each example runs.
  beforeEach(() => {
    jest.clearAllMocks();
    getSessionInvalidReason.mockResolvedValue("missing");
    cookies.mockResolvedValue({ get: jest.fn().mockReturnValue({ value: "sid-branch-copy" }) });
  });

  test("returns 401 when session missing", async () => {
    getSessionUser.mockResolvedValue(null);
    const res = await GET({}, { params: Promise.resolve({ id: "10" }) });
    expect(res.status).toBe(401);
  });

  test("passes through non-200 CRUD response", async () => {
    getSessionUser.mockResolvedValue({ id: 1 });
    getCrudRecordById.mockResolvedValue({ status: 404, body: { error: "Record not found" } });
    const res = await GET({}, { params: Promise.resolve({ id: "10" }) });
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Record not found" });
  });

  test("returns generated PDF response on success", async () => {
    getSessionUser.mockResolvedValue({ id: 1 });
    getCrudRecordById.mockResolvedValue({
      status: 200,
      body: { data: { id: 10, caseNo: "CASE/1", branch: 2, unit: 3 } }
    });
    const conn = {
      query: jest
        .fn()
        .mockResolvedValueOnce([[{ bankName: "Bank", bankCode: "SBI", branchName: "Br", branchCode: "001", place: "City", rboFullName: "RBO" }]])
        .mockResolvedValueOnce([[{ personIncharge: "PIC", unitCode: "Unit 2" }]]),
      release: jest.fn()
    };
    pool.getConnection.mockResolvedValue(conn);
    buildNewCaseInwardBranchCopyPdf.mockResolvedValue(Buffer.from("pdf"));
    safeBranchCopyPdfFilename.mockReturnValue("CASE_1_BRANCH_COPY.pdf");

    const res = await GET({}, { params: Promise.resolve({ id: "10" }) });
    expect(res.status).toBe(200);
    expect(buildNewCaseInwardBranchCopyPdf).toHaveBeenCalled();
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("CASE_1_BRANCH_COPY.pdf");
    expect(conn.release).toHaveBeenCalled();
  });
});



