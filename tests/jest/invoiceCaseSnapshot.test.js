/** @jest-environment node */

jest.mock("../../config/modules", () => ({
  modules: {
    new_case_inward: {
      table: "new_case_inward",
      fields: [{ name: "caseNo", type: "text" }],
      childTables: [
        {
          key: "amount_recovered",
          table: "amount_recovered",
          parentFkField: "parentId",
          fields: [{ name: "recoveredAmount", type: "number" }]
        }
      ]
    },
    recovery_invoice: {
      table: "recovery_invoice",
      fields: [{ name: "invoiceNo", type: "text" }, { name: "caseNo", type: "lookup" }]
    }
  }
}));

jest.mock("../../lib/crudLookupEnrich", () => ({
  enrichLookupDisplayRows: jest.fn(async (_mod, rows) => {
    for (const row of rows) {
      if (row.caseNo !== undefined) row.caseNoLabel = row.caseNo;
    }
  })
}));

jest.mock("../../lib/sqlModuleTable", () => ({
  escapeSqlTableIdForModuleConfig: jest.fn((cfg) => cfg?.table || "")
}));

jest.mock("../../lib/db", () => ({
  __esModule: true,
  default: {
    getConnection: jest.fn()
  }
}));

jest.mock("../../lib/childTablesLoad", () => ({
  loadChildTableRowsForParent: jest.fn()
}));

jest.mock("../../lib/modules/invoiceNpaCurrentAc", () => ({
  canAccessAnyInvoiceModule: jest.fn(),
  INVOICE_MODULE_KEYS_WITH_NPA_AUTO_FILL: [
    "recovery_invoice",
    "sarfaesi_invoice",
    "vehicle_invoice"
  ]
}));

jest.mock("../../lib/modules/invoicesReceived", () => ({
  INVOICES_RECEIVED_MODULE_KEY: "invoices_received"
}));

jest.mock("../../lib/rbac", () => ({
  hasModulePermission: jest.fn()
}));

const { enrichLookupDisplayRows } = require("../../lib/crudLookupEnrich");
const pool = require("../../lib/db").default;
const { loadChildTableRowsForParent } = require("../../lib/childTablesLoad");
const { canAccessAnyInvoiceModule } = require("../../lib/modules/invoiceNpaCurrentAc");
const { hasModulePermission } = require("../../lib/rbac");
const {
  loadInvoiceCaseSnapshotByCaseId,
  loadInvoiceLinkedCaseByCaseId,
  loadInvoiceRowForSnapshotById,
  canAccessInvoiceLinkedSnapshot
} = require("../../lib/modules/invoiceCaseSnapshot");

function createConn(row) {
  return {
    query: jest.fn(async (sql) => {
      if (sql.includes("WHERE id")) {
        return row ? [[row]] : [[]];
      }
      throw new Error(`Unexpected query: ${sql}`);
    }),
    release: jest.fn()
  };
}

describe("invoiceCaseSnapshot.loadInvoiceCaseSnapshotByCaseId", () => {
  test("returns enriched row by id without unit filter in SQL", async () => {
    const conn = createConn({ id: 99, caseNo: "B/CF/10001", unit: 5 });
    const row = await loadInvoiceCaseSnapshotByCaseId(conn, 99);
    expect(row).toMatchObject({ id: 99, caseNo: "B/CF/10001", unit: 5, caseNoLabel: "B/CF/10001" });
    expect(String(conn.query.mock.calls[0][0])).not.toMatch(/unit\s*=/i);
    expect(enrichLookupDisplayRows).toHaveBeenCalled();
  });

  test("returns null for invalid case id without querying", async () => {
    const conn = createConn(null);
    await expect(loadInvoiceCaseSnapshotByCaseId(conn, 0)).resolves.toBeNull();
    expect(conn.query).not.toHaveBeenCalled();
  });

  test("returns null when case row is missing", async () => {
    const conn = createConn(null);
    await expect(loadInvoiceCaseSnapshotByCaseId(conn, 404)).resolves.toBeNull();
    expect(conn.query).toHaveBeenCalled();
  });
});

describe("invoiceCaseSnapshot.loadInvoiceLinkedCaseByCaseId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns parent and requested child rows", async () => {
    const conn = createConn({ id: 10, caseNo: "S/AL/14528", branch: 3, unit: 5 });
    pool.getConnection.mockResolvedValue(conn);
    loadChildTableRowsForParent.mockResolvedValue({
      amount_recovered: [{ id: 1, recoveredAmount: 45000 }]
    });

    const result = await loadInvoiceLinkedCaseByCaseId(10, { childKeys: ["amount_recovered"] });
    expect(result?.data).toMatchObject({ id: 10, caseNo: "S/AL/14528", unit: 5 });
    expect(result?.childTableRows?.amount_recovered).toEqual([{ id: 1, recoveredAmount: 45000 }]);
    expect(loadChildTableRowsForParent).toHaveBeenCalledWith(expect.any(Object), 10);
    expect(conn.release).toHaveBeenCalled();
  });

  test("returns null for invalid case id without connecting", async () => {
    await expect(loadInvoiceLinkedCaseByCaseId(0)).resolves.toBeNull();
    expect(pool.getConnection).not.toHaveBeenCalled();
  });

  test("returns null when parent row is missing", async () => {
    const conn = createConn(null);
    pool.getConnection.mockResolvedValue(conn);
    await expect(loadInvoiceLinkedCaseByCaseId(404)).resolves.toBeNull();
    expect(conn.release).toHaveBeenCalled();
    expect(loadChildTableRowsForParent).not.toHaveBeenCalled();
  });
});

describe("invoiceCaseSnapshot.loadInvoiceRowForSnapshotById", () => {
  test("returns enriched invoice row by id without row scope SQL", async () => {
    const conn = createConn({ id: 5, invoiceNo: "INV/1", billToUnit: 3, caseNo: 10 });
    const row = await loadInvoiceRowForSnapshotById(conn, "recovery_invoice", 5);
    expect(row).toMatchObject({ id: 5, invoiceNo: "INV/1", billToUnit: 3 });
    expect(String(conn.query.mock.calls[0][0])).not.toMatch(/createdBy|unit\s*=/i);
    expect(enrichLookupDisplayRows).toHaveBeenCalled();
  });
});

describe("invoiceCaseSnapshot.canAccessInvoiceLinkedSnapshot", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("allows invoices received module access", async () => {
    canAccessAnyInvoiceModule.mockResolvedValue(false);
    hasModulePermission.mockImplementation(async (_user, moduleKey, action) => {
      return moduleKey === "invoices_received" && action === "create";
    });
    await expect(canAccessInvoiceLinkedSnapshot({ id: 1 })).resolves.toBe(true);
  });
});
