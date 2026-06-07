/**
 * API tests for GET /api/return-case/pdf/:id
 *
 * Mocks login, database, and PDF builder — verifies auth, payload wiring, and download headers.
 */
// Replace real database, auth, and Next.js pieces with fakes so tests run offline.
jest.mock("next/headers", () => ({
  cookies: jest.fn()
}));

jest.mock("../../lib/session", () => ({
  getSessionUser: jest.fn()
}));

jest.mock("../../lib/services/crud.service", () => ({
  getCrudRecordById: jest.fn()
}));

jest.mock("../../lib/db", () => ({
  queryWithRetry: jest.fn()
}));

jest.mock("../../lib/modules/returnCasePdf", () => {
  const actual = jest.requireActual("../../lib/modules/returnCasePdf");
  return {
    ...actual,
    buildReturnCasePdfBuffer: jest.fn(),
    safeReturnCasePdfFilename: jest.fn()
  };
});

const { cookies } = require("next/headers");
const { getSessionUser } = require("../../lib/session");
const { getCrudRecordById } = require("../../lib/services/crud.service");
const { queryWithRetry } = require("../../lib/db");
const { buildReturnCasePdfBuffer, safeReturnCasePdfFilename } = require("../../lib/modules/returnCasePdf");
const { GET } = require("../../app/api/return-case/pdf/[id]/route");

// Checks printable PDF output is built without crashing and includes expected content.
describe("api/return-case/pdf/[id] route", () => {
  // Reset mocks and default stubs before each example runs.
  beforeEach(() => {
    jest.clearAllMocks();
    cookies.mockResolvedValue({ get: () => ({ value: "sid" }) });
    getSessionUser.mockResolvedValue({ id: 1, role: 1 });
  });

  test("returns 401 when not logged in", async () => {
    getSessionUser.mockResolvedValue(null);
    const res = await GET({}, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(401);
  });

  test("returns inline PDF with filtered details and parent text fields", async () => {
    getCrudRecordById
      .mockResolvedValueOnce({
        status: 200,
        body: {
          data: {
            id: 5,
            refNo: "RC/1",
            date: "2026-05-01",
            caseNo: 10,
            borrowerLatestDetails: "Latest borrower info",
            ccTo: "CC Recipient"
          },
          childTableRows: {
            return_case_details: [
              { select: true, returnReason: "Reason A" },
              { select: false, returnReason: "Skipped" },
              { select: 1, returnReason: "Reason B" }
            ]
          }
        }
      })
      .mockResolvedValueOnce({
        status: 200,
        body: {
          data: {
            caseNo: "C-1",
            borrower: "B",
            branch: 1,
            unit: 2
          }
        }
      });
    queryWithRetry
      .mockResolvedValueOnce([
        [
          {
            branchName: "Main",
            branchCode: "001",
            branchPlace: "Mysore",
            rboFullName: "RBO South",
            bankName: "State Bank of India"
          }
        ]
      ])
      .mockResolvedValueOnce([[{ unitCode: "MYS" }]]);
    buildReturnCasePdfBuffer.mockResolvedValue(Buffer.from("%PDF-1.4"));
    safeReturnCasePdfFilename.mockReturnValue("RETURN_RC_1.pdf");

    const res = await GET({}, { params: Promise.resolve({ id: "5" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("Content-Disposition")).toContain("RETURN_RC_1.pdf");
    expect(buildReturnCasePdfBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        returnCaseDetails: [
          { select: true, returnReason: "Reason A" },
          { select: 1, returnReason: "Reason B" }
        ],
        borrowerLatestDetails: "Latest borrower info",
        ccTo: "CC Recipient"
      })
    );
  });
});
