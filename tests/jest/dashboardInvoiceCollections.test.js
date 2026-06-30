// Test file — Invoice Collections dashboard (config, SQL, permissions).

/**
 * Verifies invoice_collections registration, FY aggregation queries, and loadDashboard edge cases.
 * Guide: docs/DASHBOARDS.md
 */

jest.mock("../../lib/db", () => {
  const query = jest.fn();
  return {
    __esModule: true,
    default: { query },
    queryWithRetry: (sql, values) => query(sql, values)
  };
});

jest.mock("../../lib/sqlModuleTable", () => ({
  escapeSqlTableId: jest.fn((name) => String(name))
}));

const pool = require("../../lib/db").default;
const {
  aggregateInvoiceCollections,
  computeCollectedPct
} = require("../../lib/dashboards/invoice_collections/aggregateInvoiceCollections");
const { loadDashboard } = require("../../lib/dashboards/invoice_collections/run");
const { getDashboardRunner } = require("../../lib/dashboards/dashboardRegistry");
const { isDashboardKey, getDashboardConfig } = require("../../lib/dashboardConfig");
const { getRbacMatrixDashboardEntries } = require("../../lib/rbacMatrixDashboards");

jest.mock("../../lib/dashboards/loadActiveFinancialYear", () => ({
  loadActiveFinancialYear: jest.fn()
}));

const { loadActiveFinancialYear } = require("../../lib/dashboards/loadActiveFinancialYear");

const FY = {
  id: 3,
  yearCode: "2025-26",
  startDate: "2025-04-01",
  endDate: "2026-03-31",
  yearRangeLabel: "Apr 2025 – Mar 2026"
};

describe("invoice_collections dashboard config", () => {
  test("is registered with explicit permission", () => {
    expect(isDashboardKey("invoice_collections")).toBe(true);
    const cfg = getDashboardConfig("invoice_collections");
    expect(cfg?.permissionKey).toBe("dashboard_invoice_collections");
    expect(cfg?.landingWidget).toBe(true);
    expect(cfg?.autoGrantForAssignedUnit).toBeUndefined();
  });

  test("runner is registered", () => {
    expect(typeof getDashboardRunner("invoice_collections")?.loadDashboard).toBe("function");
  });
});

describe("computeCollectedPct", () => {
  test("returns percentage of received over billed", () => {
    expect(computeCollectedPct(1000, 250)).toBe(25);
    expect(computeCollectedPct(0, 100)).toBe(0);
  });
});

describe("aggregateInvoiceCollections", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("queries billed, received, pending, counts, and month-wise with FY bounds", async () => {
    pool.query.mockImplementation((sql) => {
      const s = String(sql);
      if (s.includes("SUM(inv.grandTotal)") && s.includes("recovery_invoice")) {
        return Promise.resolve([[{ billed: 1000 }]]);
      }
      if (s.includes("SUM(inv.grandTotal)") && s.includes("sarfaesi_invoice")) {
        return Promise.resolve([[{ billed: 500 }]]);
      }
      if (s.includes("SUM(inv.grandTotal)") && s.includes("vehicle_invoice")) {
        return Promise.resolve([[{ billed: 200 }]]);
      }
      if (s.includes("SUM(ir.receivedAmount)") && s.includes("recovery_invoice")) {
        return Promise.resolve([[{ received: 800 }]]);
      }
      if (s.includes("SUM(ir.receivedAmount)") && s.includes("sarfaesi_invoice")) {
        return Promise.resolve([[{ received: 300 }]]);
      }
      if (s.includes("SUM(ir.receivedAmount)") && s.includes("vehicle_invoice")) {
        return Promise.resolve([[{ received: 100 }]]);
      }
      if (s.includes("SUM(x.receivedAmount)") && s.includes("SUM(x.tdsAmount)")) {
        return Promise.resolve([[{ received: 1200, tds: 50 }]]);
      }
      if (s.includes("pendingCount")) {
        return Promise.resolve([[{ pendingCount: 2, pendingAmount: 400 }]]);
      }
      if (s.includes("COUNT(*) AS cnt") && s.includes("SELECT ir.id")) {
        return Promise.resolve([[{ cnt: 18 }]]);
      }
      if (s.includes("COUNT(*) AS cnt") && s.includes("SELECT inv.id")) {
        return Promise.resolve([[{ cnt: 42 }]]);
      }
      if (s.includes("monthKey")) {
        return Promise.resolve([
          [{ monthKey: "2025-04", monthLabel: "Apr-2025", amountReceived: 600 }]
        ]);
      }
      if (s.includes("bank_master") && s.includes("GROUP BY x.bankId")) {
        return Promise.resolve([
          [
            { bankId: 1, bankLabel: "SBI - State Bank", billed: 900 },
            { bankId: 2, bankLabel: "HDFC - HDFC Bank", billed: 800 }
          ]
        ]);
      }
      return Promise.resolve([[]]);
    });

    const result = await aggregateInvoiceCollections([1, 2], FY);

    expect(result.totals.billed).toBe(1700);
    expect(result.totals.received).toBe(1200);
    expect(result.totals.outstanding).toBe(500);
    expect(result.totals.tds).toBe(50);
    expect(result.pending.count).toBe(2);
    expect(result.counts.billed).toBe(42);
    expect(result.counts.received).toBe(18);
    expect(result.byType).toHaveLength(3);
    expect(result.byBank).toHaveLength(2);
    expect(result.byBank[0].bankLabel).toContain("SBI");
    expect(result.monthWiseReceived).toHaveLength(1);

    const bankCall = pool.query.mock.calls.find((c) =>
      String(c[0]).includes("bank_master") && String(c[0]).includes("GROUP BY x.bankId")
    );
    expect(bankCall).toBeTruthy();
    expect(String(bankCall[0])).toContain("branch_master");

    const billedCall = pool.query.mock.calls.find((c) =>
      String(c[0]).includes("recovery_invoice") && String(c[0]).includes("SUM(inv.grandTotal)")
    );
    expect(billedCall).toBeTruthy();
    expect(String(billedCall[0])).toContain("LEFT JOIN new_case_inward");
    expect(String(billedCall[0])).toContain("inv.billToUnit IN");
    expect(String(billedCall[0])).toContain("cancelledInvoice");
    expect(String(billedCall[0])).toContain("DATE(inv.date) >=");
  });

  test("pending query uses NOT EXISTS on invoices_received", async () => {
    pool.query.mockImplementation((sql) => {
      const s = String(sql);
      if (s.includes("pendingCount")) {
        return Promise.resolve([[{ pendingCount: 0, pendingAmount: 0 }]]);
      }
      if (s.includes("COUNT(*) AS cnt") && s.includes("SELECT ir.id")) {
        return Promise.resolve([[{ cnt: 0 }]]);
      }
      if (s.includes("COUNT(*) AS cnt") && s.includes("SELECT inv.id")) {
        return Promise.resolve([[{ cnt: 0 }]]);
      }
      if (s.includes("monthKey")) {
        return Promise.resolve([[]]);
      }
      if (s.includes("SUM(inv.grandTotal)")) {
        return Promise.resolve([[{ billed: 0 }]]);
      }
      if (s.includes("SUM(ir.receivedAmount)") && !s.includes("SUM(x.receivedAmount)")) {
        return Promise.resolve([[{ received: 0 }]]);
      }
      if (s.includes("SUM(x.receivedAmount)")) {
        return Promise.resolve([[{ received: 0, tds: 0 }]]);
      }
      if (s.includes("bank_master") && s.includes("GROUP BY x.bankId")) {
        return Promise.resolve([[]]);
      }
      return Promise.resolve([[]]);
    });

    await aggregateInvoiceCollections([5], FY);
    const pendingCall = pool.query.mock.calls.find((c) => String(c[0]).includes("pendingCount"));
    expect(pendingCall).toBeTruthy();
    expect(String(pendingCall[0])).toContain("NOT EXISTS");
    expect(String(pendingCall[0])).toContain("invoices_received");
  });
});

describe("loadDashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loadActiveFinancialYear.mockResolvedValue(FY);
  });

  test("returns message payload without unit", async () => {
    const result = await loadDashboard({ id: 2, role: 2, unit: null });
    expect(result.ok).toBe(true);
    expect(result.data.message).toMatch(/not assigned/i);
    expect(result.data.counts).toEqual({ billed: 0, received: 0 });
    expect(result.data.byBank).toEqual([]);
  });

  test("returns 400 when no active FY", async () => {
    loadActiveFinancialYear.mockResolvedValueOnce(null);
    const result = await loadDashboard({ id: 1, role: 1 });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });
});

describe("RBAC matrix", () => {
  test("includes dashboard_invoice_collections", () => {
    const entries = getRbacMatrixDashboardEntries();
    expect(entries.some((e) => e.key === "dashboard_invoice_collections")).toBe(true);
  });
});
