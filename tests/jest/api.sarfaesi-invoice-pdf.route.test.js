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

jest.mock("../../lib/modules/sarfaesiInvoicePdf", () => ({
  buildSarfaesiInvoicePdfBuffer: jest.fn(),
  safeSarfaesiInvoicePdfFilename: jest.fn()
}));

const { cookies } = require("next/headers");
const { getSessionUser } = require("../../lib/session");
const { getCrudRecordById } = require("../../lib/services/crud.service");
const { queryWithRetry } = require("../../lib/db");
const {
  buildSarfaesiInvoicePdfBuffer,
  safeSarfaesiInvoicePdfFilename
} = require("../../lib/modules/sarfaesiInvoicePdf");
const { GET } = require("../../app/api/sarfaesi-invoice/pdf/[id]/route");

describe("api/sarfaesi-invoice/pdf/[id] route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cookies.mockResolvedValue({ get: jest.fn().mockReturnValue({ value: "sid-sarfaesi-pdf" }) });
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
          data: { id: 5, invoiceNo: "SAR/2627/0001", date: "2026-05-16", caseNo: 10, npaCurrentAc: 2 },
          childTableRows: {
            sarfaesi_charges: [{ particularsLabel: "Legal Notice", remarks: "Test", amount: 12000 }]
          }
        }
      })
      .mockResolvedValueOnce({
        status: 200,
        body: {
          data: { id: 10, caseNo: "S/AL/14528", branch: 3, unit: 4 },
          childTableRows: {}
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

    buildSarfaesiInvoicePdfBuffer.mockResolvedValue(Buffer.from("pdf"));
    safeSarfaesiInvoicePdfFilename.mockReturnValue("Invoice_SAR_2627_0001.pdf");

    const res = await GET({}, { params: Promise.resolve({ id: "5" }) });
    expect(res.status).toBe(200);
    expect(buildSarfaesiInvoicePdfBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        charges: [{ particularsLabel: "Legal Notice", remarks: "Test", amount: 12000 }]
      })
    );
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("Invoice_SAR_2627_0001.pdf");
  });
});
