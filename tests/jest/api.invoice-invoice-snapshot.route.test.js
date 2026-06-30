/** @jest-environment node */

jest.mock("next/headers", () => ({
  cookies: jest.fn()
}));

jest.mock("../../lib/session", () => ({
  getSessionUser: jest.fn()
}));

jest.mock("../../lib/db", () => ({
  getConnection: jest.fn()
}));

jest.mock("../../lib/modules/invoiceCaseSnapshot", () => ({
  canAccessInvoiceLinkedSnapshot: jest.fn(),
  INVOICE_ROW_SNAPSHOT_MODULE_KEYS: ["recovery_invoice", "sarfaesi_invoice", "vehicle_invoice"],
  loadInvoiceRowForSnapshotById: jest.fn()
}));

const { cookies } = require("next/headers");
const { getSessionUser } = require("../../lib/session");
const pool = require("../../lib/db");
const {
  canAccessInvoiceLinkedSnapshot,
  loadInvoiceRowForSnapshotById
} = require("../../lib/modules/invoiceCaseSnapshot");
const { GET } = require("../../app/api/invoice/invoice-snapshot/[moduleKey]/[invoiceId]/route");

describe("api/invoice/invoice-snapshot/[moduleKey]/[invoiceId] route", () => {
  const release = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    cookies.mockResolvedValue({ get: jest.fn().mockReturnValue({ value: "sid-ir" }) });
    pool.getConnection.mockResolvedValue({ release });
  });

  test("returns 403 when user lacks access", async () => {
    getSessionUser.mockResolvedValue({ id: 2, role: 2 });
    canAccessInvoiceLinkedSnapshot.mockResolvedValue(false);
    const res = await GET(
      {},
      { params: Promise.resolve({ moduleKey: "recovery_invoice", invoiceId: "5" }) }
    );
    expect(res.status).toBe(403);
  });

  test("returns invoice row without row scope for invoices received users", async () => {
    getSessionUser.mockResolvedValue({ id: 2, role: 2, unit: 2 });
    canAccessInvoiceLinkedSnapshot.mockResolvedValue(true);
    loadInvoiceRowForSnapshotById.mockResolvedValue({
      id: 5,
      invoiceNo: "INV/2627/0095",
      caseNo: 10,
      billToUnit: 3,
      grandTotal: 15000
    });

    const res = await GET(
      {},
      { params: Promise.resolve({ moduleKey: "recovery_invoice", invoiceId: "5" }) }
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      data: {
        id: 5,
        invoiceNo: "INV/2627/0095",
        caseNo: 10,
        billToUnit: 3,
        grandTotal: 15000
      }
    });
    expect(loadInvoiceRowForSnapshotById).toHaveBeenCalledWith(expect.anything(), "recovery_invoice", 5);
  });

  test("returns 404 for unknown invoice module key", async () => {
    getSessionUser.mockResolvedValue({ id: 2 });
    canAccessInvoiceLinkedSnapshot.mockResolvedValue(true);
    const res = await GET(
      {},
      { params: Promise.resolve({ moduleKey: "unknown_invoice", invoiceId: "5" }) }
    );
    expect(res.status).toBe(404);
    expect(loadInvoiceRowForSnapshotById).not.toHaveBeenCalled();
  });
});
