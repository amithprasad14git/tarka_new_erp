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
  loadInvoiceCaseSnapshotByCaseId: jest.fn()
}));

const { cookies } = require("next/headers");
const { getSessionUser } = require("../../lib/session");
const pool = require("../../lib/db");
const {
  canAccessInvoiceLinkedSnapshot,
  loadInvoiceCaseSnapshotByCaseId
} = require("../../lib/modules/invoiceCaseSnapshot");
const { GET } = require("../../app/api/invoice/case-snapshot/[caseId]/route");

describe("api/invoice/case-snapshot/[caseId] route", () => {
  const release = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    cookies.mockResolvedValue({ get: jest.fn().mockReturnValue({ value: "sid-1" }) });
    pool.getConnection.mockResolvedValue({ release });
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

  test("returns case data without row scope", async () => {
    getSessionUser.mockResolvedValue({ id: 2, role: 2, unit: 2 });
    canAccessInvoiceLinkedSnapshot.mockResolvedValue(true);
    loadInvoiceCaseSnapshotByCaseId.mockResolvedValue({
      id: 10,
      caseNo: "S/AL/14528",
      unit: 5
    });

    const res = await GET({}, { params: Promise.resolve({ caseId: "10" }) });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      data: { id: 10, caseNo: "S/AL/14528", unit: 5 }
    });
    expect(loadInvoiceCaseSnapshotByCaseId).toHaveBeenCalledWith(expect.anything(), 10);
    expect(release).toHaveBeenCalled();
  });

  test("returns 404 when case not found", async () => {
    getSessionUser.mockResolvedValue({ id: 2, role: 2, unit: 2 });
    canAccessInvoiceLinkedSnapshot.mockResolvedValue(true);
    loadInvoiceCaseSnapshotByCaseId.mockResolvedValue(null);

    const res = await GET({}, { params: Promise.resolve({ caseId: "999" }) });
    expect(res.status).toBe(404);
  });
});
