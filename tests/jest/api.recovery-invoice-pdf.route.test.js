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

jest.mock("../../lib/modules/recoveryInvoicePdf", () => ({
  buildRecoveryInvoicePdfBuffer: jest.fn(),
  safeRecoveryInvoicePdfFilename: jest.fn()
}));

const { cookies } = require("next/headers");
const { getSessionUser } = require("../../lib/session");
const { getCrudRecordById } = require("../../lib/services/crud.service");
const { queryWithRetry } = require("../../lib/db");
const {
  buildRecoveryInvoicePdfBuffer,
  safeRecoveryInvoicePdfFilename
} = require("../../lib/modules/recoveryInvoicePdf");
const { GET } = require("../../app/api/recovery-invoice/pdf/[id]/route");

describe("api/recovery-invoice/pdf/[id] route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  test("returns generated PDF on success", async () => {
    getSessionUser.mockResolvedValue({ id: 1 });
    getCrudRecordById
      .mockResolvedValueOnce({
        status: 200,
        body: {
          data: { id: 5, invoiceNo: "INV/2627/0095", date: "2026-05-16", caseNo: 10, npaCurrentAc: 2 },
          childTableRows: { recovery_charges: [{ amount: 15000 }] }
        }
      })
      .mockResolvedValueOnce({
        status: 200,
        body: {
          data: { id: 10, caseNo: "S/AL/14528", branch: 3, unit: 4, entrustmentDate: "2026-05-05" },
          childTableRows: { amount_recovered: [{ recoveredDate: "2026-05-12", recoveredAmount: 45000 }] }
        }
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
      .mockResolvedValueOnce([[{ unitCode: "Unit 4" }]])
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
    expect(buildRecoveryInvoicePdfBuffer).toHaveBeenCalled();
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("Invoice_INV_2627_0095.pdf");
  });
});
