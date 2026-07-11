// Test file — Regional Performance dashboard (config, SQL, permissions, loan type grouping).

/**
 * Verifies regional_performance is registered, aggregates use loanType not loanCategory,
 * and loadDashboard handles missing unit / missing FY. Guide: README.md#5a-landing-dashboards
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
const { aggregateRegionalPerformance } = require("../../lib/dashboards/regional_performance/aggregateRegionalPerformance");
const { loadDashboard } = require("../../lib/dashboards/regional_performance/run");
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

describe("regional_performance dashboard config", () => {
  test("is registered with explicit permission", () => {
    expect(isDashboardKey("regional_performance")).toBe(true);
    const cfg = getDashboardConfig("regional_performance");
    expect(cfg?.permissionKey).toBe("dashboard_regional_performance");
    expect(cfg?.landingWidget).toBe(true);
    expect(cfg?.autoGrantForAssignedUnit).toBeUndefined();
  });

  test("runner is registered", () => {
    expect(typeof getDashboardRunner("regional_performance")?.loadDashboard).toBe("function");
  });

  test("appears in RBAC matrix with dashboard permission key", () => {
    const entries = getRbacMatrixDashboardEntries();
    const entry = entries.find((e) => e.key === "dashboard_regional_performance");
    expect(entry).toBeTruthy();
    expect(entry?.label).toMatch(/Regional Performance/i);
  });
});

describe("aggregateRegionalPerformance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("queries totals, loan type, region, and month-wise settled with FY bounds", async () => {
    pool.query.mockImplementation((sql) => {
      const s = String(sql);
      if (s.includes("loan_type_id AS loanTypeId")) {
        return Promise.resolve([
          [
            {
              loanTypeId: 10,
              loanTypeLabel: "Home Loan",
              caseCount: 5,
              amountRecovered: 800000,
              npaReduced: 200000
            }
          ]
        ]);
      }
      if (s.includes("rbo_ro_id AS regionId")) {
        return Promise.resolve([
          [
            {
              regionId: 2,
              regionLabel: "RBO-N",
              caseCount: 3,
              amountRecovered: 500000,
              npaReduced: 100000
            }
          ]
        ]);
      }
      if (s.includes("month_key AS monthKey")) {
        return Promise.resolve([
          [{ monthKey: "2025-04", monthLabel: "Apr-2025", amountRecovered: 300000 }]
        ]);
      }
      if (s.includes("SUM(x.no_of_cases), 0) AS caseCount")) {
        return Promise.resolve([
          [{ caseCount: 8, amountRecovered: 1200000, npaReduced: 350000 }]
        ]);
      }
      return Promise.resolve([[]]);
    });

    const result = await aggregateRegionalPerformance([1, 2], FY);

    expect(result.financialYear.yearCode).toBe("2025-26");
    expect(result.totals).toEqual({
      caseCount: 8,
      amountRecovered: 1200000,
      npaReduced: 350000
    });
    expect(result.byLoanType).toHaveLength(1);
    expect(result.byLoanType[0].loanTypeLabel).toBe("Home Loan");
    expect(result.byRegion).toHaveLength(1);
    expect(result.byRegion[0].regionLabel).toBe("RBO-N");
    expect(result.monthWiseSettled).toHaveLength(1);
    expect(result.monthWiseSettled[0]).toEqual({
      monthKey: "2025-04",
      monthLabel: "Apr-2025",
      amountRecovered: 300000
    });

    const settledCall = pool.query.mock.calls.find((c) =>
      String(c[0]).includes("caseStatusUpdatedDate") && String(c[0]).includes("amount_recovered > 0")
    );
    expect(settledCall).toBeTruthy();
    expect(String(settledCall[0])).toContain("nci.loanType");
    expect(String(settledCall[0])).not.toContain("nci.loanCategory");
    expect(String(settledCall[0])).toContain("lookup_value_master");
    expect(String(settledCall[0])).toContain("rbo_master");
    expect(settledCall[1]).toEqual(expect.arrayContaining(["2025-04-01", "2026-03-31"]));

    const loanTypeCall = pool.query.mock.calls.find((c) =>
      String(c[0]).includes("loan_type_id AS loanTypeId")
    );
    expect(loanTypeCall).toBeTruthy();
    expect(String(loanTypeCall[0])).toContain("GROUP BY x.loan_type_id");

    const monthCall = pool.query.mock.calls.find((c) => String(c[0]).includes("month_key AS monthKey"));
    expect(monthCall).toBeTruthy();
    expect(String(monthCall[0])).toContain("GROUP BY x.month_key");
  });

  test("uses caseStatusUpdatedDate not recoveredDate for month grouping", async () => {
    pool.query.mockImplementation((sql) => {
      const s = String(sql);
      if (s.includes("loan_type_id")) {
        return Promise.resolve([[]]);
      }
      if (s.includes("rbo_ro_id")) {
        return Promise.resolve([[]]);
      }
      if (s.includes("month_key")) {
        return Promise.resolve([[]]);
      }
      if (s.includes("caseCount")) {
        return Promise.resolve([[{ caseCount: 0, amountRecovered: 0, npaReduced: 0 }]]);
      }
      return Promise.resolve([[]]);
    });

    await aggregateRegionalPerformance([1], FY);

    const innerCall = pool.query.mock.calls.find((c) =>
      String(c[0]).includes("caseStatusUpdatedDate")
    );
    expect(innerCall).toBeTruthy();
    expect(String(innerCall[0])).not.toContain("recoveredDate");
    expect(String(innerCall[0])).toContain("DATE_FORMAT(nci.caseStatusUpdatedDate");
    expect(String(innerCall[0])).toContain("nci.loanType");
    expect(String(innerCall[0])).not.toContain("nci.loanCategory");
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
    expect(result.data.totals).toEqual({ caseCount: 0, amountRecovered: 0, npaReduced: 0 });
    expect(result.data.byLoanType).toEqual([]);
    expect(result.data.byRegion).toEqual([]);
    expect(result.data.monthWiseSettled).toEqual([]);
  });

  test("returns 400 when no active FY", async () => {
    loadActiveFinancialYear.mockResolvedValueOnce(null);
    const result = await loadDashboard({ id: 1, role: 1 });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  test("returns 401 when no user", async () => {
    const result = await loadDashboard(null);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
  });
});

