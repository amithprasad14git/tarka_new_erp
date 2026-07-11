// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for GET /api/sarfaesi-case-status-update/covering-132-paper-publication-pdf/:id
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
  buildSarfaesiCovering132PaperPublicationPdfBuffer: jest.fn(),
  safeSarfaesiCovering132PaperPublicationPdfFilename: jest.fn()
}));

const { cookies } = require("next/headers");
const { getSessionUser, getSessionInvalidReason } = require("../../lib/session");
const { getCrudRecordById } = require("../../lib/services/crud.service");
const { queryWithRetry } = require("../../lib/db");
const { loadInvoiceLinkedCaseByCaseId } = require("../../lib/modules/invoiceCaseSnapshot");
const {
  buildSarfaesiCovering132PaperPublicationPdfBuffer,
  safeSarfaesiCovering132PaperPublicationPdfFilename
} = require("../../lib/modules/sarfaesiCaseStatusUpdateCovering132Pdf");
const {
  GET
} = require("../../app/api/(cases)/sarfaesi-case-status-update/covering-132-paper-publication-pdf/[id]/route");

describe("api/sarfaesi-case-status-update/covering-132-paper-publication-pdf/[id] route", () => {
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
            {
              particularsLabel: "13(2) Acknowledgements Received?",
              remarks: "2026-07-01"
            }
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
    buildSarfaesiCovering132PaperPublicationPdfBuffer.mockResolvedValue(Buffer.from("%PDF-mock"));
    safeSarfaesiCovering132PaperPublicationPdfFilename.mockReturnValue(
      "COVERING_132_PAPER_PUB_SRFUP_2627_0001.pdf"
    );

    const res = await GET({}, { params: Promise.resolve({ id: "10" }) });
    expect(res.status).toBe(200);
    expect(buildSarfaesiCovering132PaperPublicationPdfBuffer).toHaveBeenCalled();
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain(
      "COVERING_132_PAPER_PUB_SRFUP_2627_0001.pdf"
    );
  });
});
