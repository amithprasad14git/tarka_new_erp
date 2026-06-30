// Test file — Unit Wise Recovery Target dashboard (FY, SQL, scoping, permissions).

/**
 * Verifies recovery target registration, settled-in-FY SQL (Unit Wise Cumulative rules), and unit scoping.
 * Guide: docs/DASHBOARDS.md
 */

jest.mock("mysql2", () => ({
  escapeId: jest.fn((v) => `\`${String(v)}\``)
}));

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

jest.mock("../../lib/rbac", () => ({
  hasAnyModuleAccess: jest.fn()
}));

const pool = require("../../lib/db").default;
const { hasAnyModuleAccess } = require("../../lib/rbac");
const { canAccessDashboard } = require("../../lib/dashboards/dashboardAccess");
const { loadActiveFinancialYear } = require("../../lib/dashboards/loadActiveFinancialYear");
const {
  buildBankWiseRecoveryAggregationSql,
  buildUnitRecoveryTargetSql,
  buildRecoveredCaseCountSql,
  buildPartRecoveredCaseCountSql,
  buildMonthWiseRecoverySql,
  buildPendingCaseStatusCountSql,
  pendingCaseStatusCountBindValues,
  loadDashboard
} = require("../../lib/dashboards/unit_wise_recovery_target/run");
const { getDashboardRunner } = require("../../lib/dashboards/dashboardRegistry");
const { loadDashboardForUser } = require("../../lib/dashboards/dashboard.service");
const { isDashboardKey, getDashboardConfig } = require("../../lib/dashboardConfig");
const { formatDashboardUpdatedAt } = require("../../lib/formatDashboardUpdatedAt");

function mockCompanionQueries({
  recoveryTarget = 0,
  banks = [],
  recoveredCaseCount = 0,
  partRecoveredCaseCount = 0,
  monthWise = [],
  caseStatusCounts = []
} = {}) {
  pool.query
    .mockResolvedValueOnce([[{ recoveryTarget }]])
    .mockResolvedValueOnce([banks])
    .mockResolvedValueOnce([[{ recoveredCaseCount }]])
    .mockResolvedValueOnce([[{ partRecoveredCaseCount }]])
    .mockResolvedValueOnce([monthWise])
    .mockResolvedValueOnce([caseStatusCounts]);
}

describe("dashboard config", () => {
  test("unit_wise_recovery_target is registered", () => {
    expect(isDashboardKey("unit_wise_recovery_target")).toBe(true);
    const cfg = getDashboardConfig("unit_wise_recovery_target");
    expect(cfg?.permissionKey).toBe("dashboard_unit_wise_recovery_target");
    expect(cfg?.landingWidget).toBe(true);
    expect(cfg?.autoGrantForAssignedUnit).toBeUndefined();
  });

  test("runner is registered", () => {
    expect(typeof getDashboardRunner("unit_wise_recovery_target")?.loadDashboard).toBe("function");
  });
});

describe("loadActiveFinancialYear", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns current active FY when today is within range", async () => {
    pool.query.mockResolvedValueOnce([
      [{ id: 3, yearCode: "2025-26", startDate: "2025-04-01", endDate: "2026-03-31" }]
    ]);

    const fy = await loadActiveFinancialYear();
    expect(fy?.id).toBe(3);
    expect(fy?.yearCode).toBe("2025-26");
    expect(fy?.yearRangeLabel).toMatch(/2025/);
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(String(pool.query.mock.calls[0][0])).toContain("CURDATE()");
  });

  test("falls back to latest active FY when none contains today", async () => {
    pool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([
        [{ id: 2, yearCode: "2024-25", startDate: "2024-04-01", endDate: "2025-03-31" }]
      ]);

    const fy = await loadActiveFinancialYear();
    expect(fy?.id).toBe(2);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test("returns null when no active financial year exists", async () => {
    pool.query.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[]]);
    expect(await loadActiveFinancialYear()).toBeNull();
  });
});

describe("buildBankWiseRecoveryAggregationSql", () => {
  test("aggregates settled-in-FY lifetime recovery grouped by bank", () => {
    const sql = buildBankWiseRecoveryAggregationSql(1);
    expect(sql).toContain("caseStatusUpdatedDate >= ?");
    expect(sql).toContain("caseStatusUpdatedDate <= ?");
    expect(sql).toContain("LOWER(TRIM(cs.lookupValue)) IN");
    expect(sql).toContain("amount_recovered > 0");
    expect(sql).not.toContain("DATE(ar.recoveredDate)");
    expect(sql).not.toContain("bank.active");
    expect(sql).toContain("GROUP BY x.bankId");
    expect(sql).toContain("HAVING amountRecovered > 0");
  });

  test("scopes settled cases to unit IN clause", () => {
    const sql = buildBankWiseRecoveryAggregationSql(3);
    expect(sql).toContain("nci.unit IN (?, ?, ?)");
  });
});

describe("buildUnitRecoveryTargetSql", () => {
  test("sums recoveryTarget for scoped units", () => {
    const sql = buildUnitRecoveryTargetSql(2);
    expect(sql).toContain("SUM(um.recoveryTarget)");
    expect(sql).toContain("WHERE um.id IN (?, ?)");
  });
});

describe("companion widget SQL helpers", () => {
  test("buildRecoveredCaseCountSql counts settled cases in FY", () => {
    const sql = buildRecoveredCaseCountSql(1);
    expect(sql).toContain("SUM(x.no_of_cases)");
    expect(sql).toContain("caseStatusUpdatedDate >= ?");
    expect(sql).not.toContain("DATE(ar.recoveredDate)");
  });

  test("buildPartRecoveredCaseCountSql uses open case and recovered > 0 filters", () => {
    const sql = buildPartRecoveredCaseCountSql(1);
    expect(sql).toContain("COUNT(DISTINCT nci.id)");
    expect(sql).toContain("lookup_value_master");
    expect(sql).toContain("SUM(ar.recoveredAmount)");
  });

  test("buildMonthWiseRecoverySql groups by settlement month", () => {
    const sql = buildMonthWiseRecoverySql(2);
    expect(sql).toContain("DATE_FORMAT(nci.caseStatusUpdatedDate, '%Y-%m')");
    expect(sql).toContain("GROUP BY x.monthKey");
    expect(sql).toContain("nci.unit IN (?, ?)");
  });

  test("buildPendingCaseStatusCountSql groups pending cases on hand by case status", () => {
    const sql = buildPendingCaseStatusCountSql(2);
    expect(sql).toContain("COUNT(DISTINCT nci.id)");
    expect(sql).toContain("lookup_value_master");
    expect(sql).toContain("GROUP BY statusLabel");
    expect(sql).toContain("WHERE nci.unit IN (?, ?)");
    expect(sql).toContain("DATE(nci.entrustmentDate) <= CURDATE()");
    expect(sql).toContain("nci.caseStatus IS NULL OR cs.lookupValue IS NULL");
    expect(sql).toContain("LOWER(TRIM(cs.lookupValue)) NOT IN");
    expect(sql).toContain("TRIM(cs.lookupValue) <> ''");
    expect(sql).toContain("INNER JOIN");
  });

  test("pendingCaseStatusCountBindValues appends open-case filter values after unit ids", () => {
    const { extraValues } = pendingCaseStatusCountBindValues(2);
    expect(Array.isArray(extraValues)).toBe(true);
    expect(extraValues.length).toBeGreaterThan(0);
  });
});

describe("loadDashboard unit scoping", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("admin loads bank rows, KPIs, and month-wise recovery", async () => {
    pool.query
      .mockResolvedValueOnce([
        [{ id: 3, yearCode: "2025-26", startDate: "2025-04-01", endDate: "2026-03-31" }]
      ])
      .mockResolvedValueOnce([[{ id: 1 }, { id: 2 }]]);
    mockCompanionQueries({
      recoveryTarget: 1800000,
      banks: [
        { bankId: 10, bankLabel: "SBI - State Bank", amountRecovered: 500000 },
        { bankId: 11, bankLabel: "CAN - Canara Bank", amountRecovered: 400000 }
      ],
      recoveredCaseCount: 42,
      partRecoveredCaseCount: 7,
      monthWise: [
        { monthKey: "2025-04", monthLabel: "Apr-2025", amountRecovered: 300000 },
        { monthKey: "2025-05", monthLabel: "May-2025", amountRecovered: 600000 }
      ],
      caseStatusCounts: [
        { statusLabel: "Closed", caseCount: 120 },
        { statusLabel: "Open", caseCount: 45 }
      ]
    });

    const result = await loadDashboard({ id: 1, role: 1, unit: null });
    expect(result.ok).toBe(true);
    expect(result.data.rows).toHaveLength(2);
    expect(result.data.totals.amountRecovered).toBe(900000);
    expect(result.data.totals.gapToTarget).toBe(900000);
    expect(result.data.kpis.recoveredCaseCount).toBe(42);
    expect(result.data.kpis.partRecoveredCaseCount).toBe(7);
    expect(result.data.kpis.caseStatusCounts).toHaveLength(2);
    expect(result.data.kpis.caseStatusCounts[0].statusLabel).toBe("Closed");
    expect(result.data.monthWiseRecovery).toHaveLength(2);
    const statusQueryCall = pool.query.mock.calls[7];
    expect(statusQueryCall[1]).toEqual(expect.arrayContaining([1, 2]));
    expect(statusQueryCall[1].length).toBeGreaterThan(2);
  });

  test("non-admin loads bank-wise rows for assigned unit only", async () => {
    pool.query
      .mockResolvedValueOnce([
        [{ id: 3, yearCode: "2025-26", startDate: "2025-04-01", endDate: "2026-03-31" }]
      ])
      .mockResolvedValueOnce([[{ id: 5 }]]);
    mockCompanionQueries({
      recoveryTarget: 500000,
      banks: [{ bankId: 12, bankLabel: "UCO - UCO Bank", amountRecovered: 250000 }],
      recoveredCaseCount: 5,
      partRecoveredCaseCount: 2,
      monthWise: [{ monthKey: "2025-06", monthLabel: "Jun-2025", amountRecovered: 250000 }]
    });

    const result = await loadDashboard({ id: 2, role: 2, unit: 5 });
    expect(result.ok).toBe(true);
    expect(result.data.rows).toHaveLength(1);
    expect(result.data.kpis.gapToTarget).toBe(250000);
    expect(pool.query.mock.calls[1][1]).toEqual([5]);
  });

  test("user without unit gets message and empty companion payload", async () => {
    pool.query.mockResolvedValueOnce([
      [{ id: 3, yearCode: "2025-26", startDate: "2025-04-01", endDate: "2026-03-31" }]
    ]);

    const result = await loadDashboard({ id: 2, role: 2, unit: null });
    expect(result.ok).toBe(true);
    expect(result.data.rows).toEqual([]);
    expect(result.data.kpis.recoveredCaseCount).toBe(0);
    expect(result.data.kpis.caseStatusCounts).toEqual([]);
    expect(result.data.monthWiseRecovery).toEqual([]);
    expect(result.data.message).toMatch(/not assigned to a unit/i);
  });

  test("returns 400 when no active financial year", async () => {
    pool.query.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[]]);
    const result = await loadDashboard({ id: 1, role: 1 });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });
});

describe("loadDashboardForUser permissions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hasAnyModuleAccess.mockResolvedValue(false);
  });

  test("returns 403 when user lacks dashboard permission", async () => {
    const result = await loadDashboardForUser(
      { id: 2, role: 2, unit: null },
      "unit_wise_recovery_target"
    );
    expect(result.status).toBe(403);
  });

  test("returns 403 for role 2 user with assigned unit but no matrix permission", async () => {
    const result = await loadDashboardForUser(
      { id: 2, role: 2, unit: 5 },
      "unit_wise_recovery_target"
    );
    expect(result.status).toBe(403);
    expect(hasAnyModuleAccess).toHaveBeenCalled();
  });

  test("allows role 2 user when hasAnyModuleAccess grants dashboard permission", async () => {
    hasAnyModuleAccess.mockResolvedValue(true);
    pool.query
      .mockResolvedValueOnce([
        [{ id: 3, yearCode: "2025-26", startDate: "2025-04-01", endDate: "2026-03-31" }]
      ])
      .mockResolvedValueOnce([[{ id: 5 }]]);
    mockCompanionQueries({
      recoveryTarget: 100,
      banks: [{ bankId: 1, bankLabel: "SBI - Bank", amountRecovered: 50 }],
      recoveredCaseCount: 1,
      partRecoveredCaseCount: 0,
      monthWise: []
    });

    const result = await loadDashboardForUser(
      { id: 2, role: 2, unit: 5 },
      "unit_wise_recovery_target"
    );
    expect(result.status).toBe(200);
    expect(result.body.kpis).toBeDefined();
    expect(hasAnyModuleAccess).toHaveBeenCalled();
  });

  test("returns 404 for unknown dashboard key", async () => {
    const result = await loadDashboardForUser({ id: 1, role: 1 }, "unknown_dashboard");
    expect(result.status).toBe(404);
  });
});

describe("canAccessDashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hasAnyModuleAccess.mockResolvedValue(false);
  });

  test("denies when user has unit but no explicit permission", async () => {
    const allowed = await canAccessDashboard({ id: 2, role: 2, unit: 3 }, "unit_wise_recovery_target");
    expect(allowed).toBe(false);
    expect(hasAnyModuleAccess).toHaveBeenCalled();
  });

  test("allows when user has explicit permission", async () => {
    hasAnyModuleAccess.mockResolvedValue(true);
    const allowed = await canAccessDashboard({ id: 2, role: 2, unit: 3 }, "unit_wise_recovery_target");
    expect(allowed).toBe(true);
  });

  test("denies when no unit and no explicit permission", async () => {
    const allowed = await canAccessDashboard({ id: 2, role: 2, unit: null }, "unit_wise_recovery_target");
    expect(allowed).toBe(false);
  });
});

describe("formatDashboardUpdatedAt", () => {
  test("formats time in Updated HH:MM AM/PM pattern", () => {
    const label = formatDashboardUpdatedAt(new Date("2026-04-15T05:12:00.000Z"));
    expect(label).toMatch(/^Updated \d{1,2}:\d{2} (AM|PM)$/);
  });
});
