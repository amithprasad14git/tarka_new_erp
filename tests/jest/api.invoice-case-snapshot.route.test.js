/** @jest-environment node */

jest.mock("next/headers", () => ({
  cookies: jest.fn()
}));

jest.mock("../../lib/session", () => ({
  getSessionUser: jest.fn()
}));

jest.mock("../../lib/modules/invoiceCaseSnapshot", () => ({
  canAccessInvoiceLinkedSnapshot: jest.fn(),
  INVOICE_ROW_SNAPSHOT_MODULE_KEYS: ["recovery_invoice", "sarfaesi_invoice", "vehicle_invoice"],
  loadInvoiceLinkedCaseByCaseId: jest.fn()
}));

const { cookies } = require("next/headers");
const { getSessionUser } = require("../../lib/session");
const {
  canAccessInvoiceLinkedSnapshot,
  loadInvoiceLinkedCaseByCaseId
} = require("../../lib/modules/invoiceCaseSnapshot");
const { GET } = require("../../app/api/invoice/case-snapshot/[caseId]/route");

describe("api/invoice/case-snapshot/[caseId] route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cookies.mockResolvedValue({ get: jest.fn().mockReturnValue({ value: "sid-1" }) });
  });

  test("returns 401 when session missing", async () => {
    getSessionUser.mockResolvedValue(null);
    const res = await GET({}, { params: Promise.resolve({ caseId: "10" }) });
    expect(res.status).toBe(401);
  });

  test("returns 403 when user lacks invoice or invoices received access", async () => {
    getSessionUser.mockResolvedValue({ id: 2, role: 2, unit: 2 });
    canAccessInvoiceLinkedSnapshot.mockResolvedValue(false);
    const res = await GET({}, { params: Promise.resolve({ caseId: "10" }) });
    expect(res.status).toBe(403);
  });

  test("returns case data and amount_recovered child rows", async () => {
    getSessionUser.mockResolvedValue({ id: 2, role: 2, unit: 2 });
    canAccessInvoiceLinkedSnapshot.mockResolvedValue(true);
    loadInvoiceLinkedCaseByCaseId.mockResolvedValue({
      data: { id: 10, caseNo: "S/AL/14528", unit: 5 },
      childTableRows: {
        amount_recovered: [{ id: 1, recoveredDate: "2026-05-01", recoveredAmount: 1000 }]
      }
    });

    const res = await GET({}, { params: Promise.resolve({ caseId: "10" }) });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      data: { id: 10, caseNo: "S/AL/14528", unit: 5 },
      childTableRows: {
        amount_recovered: [{ id: 1, recoveredDate: "2026-05-01", recoveredAmount: 1000 }]
      }
    });
    expect(loadInvoiceLinkedCaseByCaseId).toHaveBeenCalledWith(10, {
      childKeys: ["amount_recovered"]
    });
  });

  test("returns 404 when case not found", async () => {
    getSessionUser.mockResolvedValue({ id: 2, role: 2, unit: 2 });
    canAccessInvoiceLinkedSnapshot.mockResolvedValue(true);
    loadInvoiceLinkedCaseByCaseId.mockResolvedValue(null);

    const res = await GET({}, { params: Promise.resolve({ caseId: "999" }) });
    expect(res.status).toBe(404);
  });
});
