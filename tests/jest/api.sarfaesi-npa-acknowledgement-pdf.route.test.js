// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for GET /api/sarfaesi-case-status-update/npa-acknowledgement-pdf/:id
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

jest.mock("../../lib/modules/sarfaesiCaseStatusUpdateNpaAckPdf", () => ({
  buildSarfaesiNpaAckPdfBuffer: jest.fn(),
  safeSarfaesiNpaAckPdfFilename: jest.fn()
}));

const { cookies } = require("next/headers");
const { getSessionUser, getSessionInvalidReason } = require("../../lib/session");
const { getCrudRecordById } = require("../../lib/services/crud.service");
const { queryWithRetry } = require("../../lib/db");
const { loadInvoiceLinkedCaseByCaseId } = require("../../lib/modules/invoiceCaseSnapshot");
const {
  buildSarfaesiNpaAckPdfBuffer,
  safeSarfaesiNpaAckPdfFilename
} = require("../../lib/modules/sarfaesiCaseStatusUpdateNpaAckPdf");
const { GET } = require("../../app/api/(cases)/sarfaesi-case-status-update/npa-acknowledgement-pdf/[id]/route");

describe("api/sarfaesi-case-status-update/npa-acknowledgement-pdf/[id] route", () => {
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
        data: { id: 10, refNo: "SRFUP/2627/0001", caseNo: 5, date: "2026-06-24" }
      }
    });
    loadInvoiceLinkedCaseByCaseId.mockResolvedValue({
      data: {
        borrower: "Test",
        loanAccountNo: "1",
        loanTypeLabel: "ABAL",
        fileMaintenanceLabel: "Branch Custody",
        branch: 2,
        unit: 3
      }
    });
    queryWithRetry.mockResolvedValueOnce([
      [
        {
          branchName: "Br",
          branchCode: "001",
          branchPlace: "City",
          rboFullName: "RBO",
          bankName: "Bank"
        }
      ]
    ]);
    buildSarfaesiNpaAckPdfBuffer.mockResolvedValue(Buffer.from("%PDF-mock"));
    safeSarfaesiNpaAckPdfFilename.mockReturnValue("NPA_ACK_SRFUP_2627_0001.pdf");

    const res = await GET({}, { params: Promise.resolve({ id: "10" }) });
    expect(res.status).toBe(200);
    expect(buildSarfaesiNpaAckPdfBuffer).toHaveBeenCalled();
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("NPA_ACK_SRFUP_2627_0001.pdf");
  });
});
