// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for GET /api/sarfaesi-case-status-update/covering-132-pdf/:id
 */

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

jest.mock("../../lib/db", () => ({
  queryWithRetry: jest.fn()
}));

jest.mock("../../lib/modules/invoiceCaseSnapshot", () => ({
  loadInvoiceLinkedCaseByCaseId: jest.fn()
}));

jest.mock("../../lib/modules/sarfaesiCaseStatusUpdateCovering132Pdf", () => ({
  buildSarfaesiCovering132PdfBuffer: jest.fn(),
  safeSarfaesiCovering132PdfFilename: jest.fn()
}));

const { cookies } = require("next/headers");
const { getSessionUser, getSessionInvalidReason } = require("../../lib/session");
const { getCrudRecordById } = require("../../lib/services/crud.service");
const { queryWithRetry } = require("../../lib/db");
const { loadInvoiceLinkedCaseByCaseId } = require("../../lib/modules/invoiceCaseSnapshot");
const {
  buildSarfaesiCovering132PdfBuffer,
  safeSarfaesiCovering132PdfFilename
} = require("../../lib/modules/sarfaesiCaseStatusUpdateCovering132Pdf");
const { GET } = require("../../app/api/(cases)/sarfaesi-case-status-update/covering-132-pdf/[id]/route");

describe("api/sarfaesi-case-status-update/covering-132-pdf/[id] route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSessionInvalidReason.mockResolvedValue("missing");
    cookies.mockResolvedValue({ get: () => ({ value: "sid" }) });
    getSessionUser.mockResolvedValue({ id: 1, role: 1 });
  });

  test("returns 401 when not logged in", async () => {
    getSessionUser.mockResolvedValue(null);
    const res = await GET({}, { params: Promise.resolve({ id: "10" }) });
    expect(res.status).toBe(401);
  });

  test("returns generated PDF on success", async () => {
    getCrudRecordById.mockResolvedValue({
      status: 200,
      body: {
        data: { id: 10, refNo: "SRFUP/2627/0001", caseNo: 5, date: "2026-06-24" },
        childTableRows: {
          sarfaesi_case_status_update_details: [
            { particularsLabel: "Date of 13(2)", remarks: "2026-06-24" }
          ]
        }
      }
    });
    loadInvoiceLinkedCaseByCaseId.mockResolvedValue({
      data: {
        borrower: "Test",
        loanAccountNo: "1",
        loanTypeLabel: "ABAL",
        branch: 2,
        unit: 3
      }
    });
    queryWithRetry
      .mockResolvedValueOnce([
        [
          {
            branchName: "Br",
            branchCode: "001",
            branchPlace: "City",
            rboFullName: "RBO",
            bankName: "Bank"
          }
        ]
      ])
      .mockResolvedValueOnce([[{ personIncharge: "Amith Prasad" }]]);
    buildSarfaesiCovering132PdfBuffer.mockResolvedValue(Buffer.from("%PDF-mock"));
    safeSarfaesiCovering132PdfFilename.mockReturnValue("COVERING_132_SRFUP_2627_0001.pdf");

    const res = await GET({}, { params: Promise.resolve({ id: "10" }) });
    expect(res.status).toBe(200);
    expect(buildSarfaesiCovering132PdfBuffer).toHaveBeenCalled();
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("COVERING_132_SRFUP_2627_0001.pdf");
  });
});
