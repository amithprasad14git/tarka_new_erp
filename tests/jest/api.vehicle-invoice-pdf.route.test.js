/** @jest-environment node */

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

jest.mock("../../lib/modules/vehicleInvoicePdf", () => ({
  buildVehicleInvoicePdfBuffer: jest.fn(),
  safeVehicleInvoicePdfFilename: jest.fn()
}));

const { cookies } = require("next/headers");
const { getSessionUser, getSessionInvalidReason } = require("../../lib/session");
const { getCrudRecordById } = require("../../lib/services/crud.service");
const { queryWithRetry } = require("../../lib/db");
const { loadInvoiceLinkedCaseByCaseId } = require("../../lib/modules/invoiceCaseSnapshot");
const {
  buildVehicleInvoicePdfBuffer,
  safeVehicleInvoicePdfFilename
} = require("../../lib/modules/vehicleInvoicePdf");
const { GET } = require("../../app/api/(invoices)/vehicle-invoice/pdf/[id]/route");

describe("api/vehicle-invoice/pdf/[id] route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSessionInvalidReason.mockResolvedValue("missing");
    cookies.mockResolvedValue({ get: jest.fn().mockReturnValue({ value: "sid-vehicle-pdf" }) });
  });

  test("returns generated PDF with bypass case loader and billToUnit unit code", async () => {
    getSessionUser.mockResolvedValue({ id: 1 });
    getCrudRecordById.mockResolvedValueOnce({
      status: 200,
      body: {
        data: { id: 5, invoiceNo: "VEH/1", caseNo: 10, billToUnit: 3, npaCurrentAc: null },
        childTableRows: { vehicle_charges: [{ amount: 5000 }] }
      }
    });
    loadInvoiceLinkedCaseByCaseId.mockResolvedValue({
      data: { id: 10, caseNo: "V/1", branch: 3, unit: 2, borrower: "Vehicle Borrower" }
    });
    queryWithRetry
      .mockResolvedValueOnce([[{ branchName: "B", branchCode: "1", bankName: "Bank", bankCode: "B" }]])
      .mockResolvedValueOnce([[{ unitCode: "Bill Unit 3" }]]);

    buildVehicleInvoicePdfBuffer.mockResolvedValue(Buffer.from("pdf"));
    safeVehicleInvoicePdfFilename.mockReturnValue("Invoice_VEH_1.pdf");

    const res = await GET({}, { params: Promise.resolve({ id: "5" }) });
    expect(res.status).toBe(200);
    expect(loadInvoiceLinkedCaseByCaseId).toHaveBeenCalledWith(10);
    expect(getCrudRecordById).toHaveBeenCalledTimes(1);
    expect(buildVehicleInvoicePdfBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        unitShortCode: "Bill Unit 3",
        nciRow: expect.objectContaining({ borrower: "Vehicle Borrower" })
      })
    );
  });
});
