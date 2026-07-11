// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `api.recovery-invoice-pdf.route`.
 * Run with: npm test
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

jest.mock("../../lib/modules/recoveryInvoicePdf", () => ({
  buildRecoveryInvoicePdfBuffer: jest.fn(),
  safeRecoveryInvoicePdfFilename: jest.fn()
}));

const { cookies } = require("next/headers");
const { getSessionUser, getSessionInvalidReason } = require("../../lib/session");
const { getCrudRecordById } = require("../../lib/services/crud.service");
const { queryWithRetry } = require("../../lib/db");
const { loadInvoiceLinkedCaseByCaseId } = require("../../lib/modules/invoiceCaseSnapshot");
const {
  buildRecoveryInvoicePdfBuffer,
  safeRecoveryInvoicePdfFilename
} = require("../../lib/modules/recoveryInvoicePdf");
const { GET } = require("../../app/api/(invoices)/recovery-invoice/pdf/[id]/route");

describe("api/recovery-invoice/pdf/[id] route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSessionInvalidReason.mockResolvedValue("missing");
    cookies.mockResolvedValue({ get: jest.fn().mockReturnValue({ value: "sid-recovery-pdf" }) });
  });

  test("returns 401 when session missing", async () => {
    getSessionUser.mockResolvedValue(null);
    const res = await GET({}, { params: Promise.resolve({ id: "5" }) });
    expect(res.status).toBe(401);
  });

  test("passes through non-200 CRUD response", async () => {
    getSessionUser.mockResolvedValue({ id: 1 });
    getCrudRecordById.mockResolvedValue({ status: 404, body: { error: "Record not found" } });
    const res = await GET({}, { params: Promise.resolve({ id: "5" }) });
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Record not found" });
  });

  test("returns generated PDF on success with bypass case loader", async () => {
    getSessionUser.mockResolvedValue({ id: 1 });
    getCrudRecordById.mockResolvedValueOnce({
      status: 200,
      body: {
        data: {
          id: 5,
          invoiceNo: "INV/2627/0095",
          date: "2026-05-16",
          caseNo: 10,
          billToUnit: 3,
          npaCurrentAc: 2
        },
        childTableRows: { recovery_charges: [{ amount: 15000 }] }
      }
    });
    loadInvoiceLinkedCaseByCaseId.mockResolvedValue({
      data: { id: 10, caseNo: "S/AL/14528", branch: 3, unit: 2, borrower: "Test Borrower" },
      childTableRows: { amount_recovered: [{ recoveredDate: "2026-05-12", recoveredAmount: 45000 }] }
    });
    queryWithRetry
      .mockResolvedValueOnce([
        [
          {
            branchName: "Tagadur",
            branchCode: "040077",
            branchPlace: "Mysore",
            rboFullName: "RBO 1",
            bankCode: "SBI",
            bankName: "State Bank of India"
          }
        ]
      ])
      .mockResolvedValueOnce([[{ unitCode: "Unit 3 Bill" }]])
      .mockResolvedValueOnce([
        [
          {
            accountName: "NPA Enforcement Squad (P) Ltd.",
            accountNo: "40020692454",
            branch: "SBI Siddartha Layout",
            ifscCode: "SBIN0016501",
            gstNo: "29AAHCN3437C1ZJ",
            bankName: "State Bank of India",
            bankCode: "SBI"
          }
        ]
      ]);

    buildRecoveryInvoicePdfBuffer.mockResolvedValue(Buffer.from("pdf"));
    safeRecoveryInvoicePdfFilename.mockReturnValue("Invoice_INV_2627_0095.pdf");

    const res = await GET({}, { params: Promise.resolve({ id: "5" }) });
    expect(res.status).toBe(200);
    expect(loadInvoiceLinkedCaseByCaseId).toHaveBeenCalledWith(10, { childKeys: ["amount_recovered"] });
    expect(getCrudRecordById).toHaveBeenCalledTimes(1);
    expect(buildRecoveryInvoicePdfBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        unitShortCode: "Unit 3 Bill",
        nciRow: expect.objectContaining({ caseNo: "S/AL/14528", borrower: "Test Borrower", unit: 2 }),
        amountRecoveredRows: [{ recoveredDate: "2026-05-12", recoveredAmount: 45000 }]
      })
    );
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
  });

  test("uses billToUnit for unit code not case unit", async () => {
    getSessionUser.mockResolvedValue({ id: 1 });
    getCrudRecordById.mockResolvedValueOnce({
      status: 200,
      body: {
        data: { id: 5, invoiceNo: "INV/1", caseNo: 10, billToUnit: 3, npaCurrentAc: null },
        childTableRows: { recovery_charges: [] }
      }
    });
    loadInvoiceLinkedCaseByCaseId.mockResolvedValue({
      data: { id: 10, caseNo: "C/1", branch: 3, unit: 2 },
      childTableRows: { amount_recovered: [] }
    });
    queryWithRetry
      .mockResolvedValueOnce([[{ branchName: "B", branchCode: "1", bankName: "Bank", bankCode: "B" }]])
      .mockResolvedValueOnce([[{ unitCode: "Billed Unit 3" }]]);

    buildRecoveryInvoicePdfBuffer.mockResolvedValue(Buffer.from("pdf"));
    safeRecoveryInvoicePdfFilename.mockReturnValue("Invoice_1.pdf");

    await GET({}, { params: Promise.resolve({ id: "5" }) });

    expect(buildRecoveryInvoicePdfBuffer).toHaveBeenCalledWith(
      expect.objectContaining({ unitShortCode: "Billed Unit 3" })
    );
  });

  test("blank case fields when caseNo is empty", async () => {
    getSessionUser.mockResolvedValue({ id: 1 });
    getCrudRecordById.mockResolvedValueOnce({
      status: 200,
      body: {
        data: { id: 5, invoiceNo: "INV/NO-CASE", billToUnit: 2, npaCurrentAc: null },
        childTableRows: { recovery_charges: [{ amount: 1000 }] }
      }
    });
    queryWithRetry.mockResolvedValueOnce([[{ unitCode: "Unit 2" }]]);

    buildRecoveryInvoicePdfBuffer.mockResolvedValue(Buffer.from("pdf"));
    safeRecoveryInvoicePdfFilename.mockReturnValue("Invoice_NO_CASE.pdf");

    await GET({}, { params: Promise.resolve({ id: "5" }) });

    expect(loadInvoiceLinkedCaseByCaseId).not.toHaveBeenCalled();
    expect(buildRecoveryInvoicePdfBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        unitShortCode: "Unit 2",
        nciRow: expect.objectContaining({
          caseNo: "",
          borrower: "",
          loanAccountNo: ""
        }),
        amountRecoveredRows: [],
        branchContext: expect.objectContaining({ bankName: "", branchDisplay: "" })
      })
    );
  });
});

