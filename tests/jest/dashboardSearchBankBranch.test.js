// Test file — Search Bank & Branch dashboard (config, SQL, permissions).

/**
 * Verifies search_bank_branch registration and branch search SQL.
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
const { searchBranches, MIN_TERM_LENGTH, RESULT_LIMIT } = require("../../lib/dashboards/search_bank_branch/searchBranches");
const { loadDashboard } = require("../../lib/dashboards/search_bank_branch/run");
const { getDashboardRunner } = require("../../lib/dashboards/dashboardRegistry");
const { isDashboardKey, getDashboardConfig } = require("../../lib/dashboardConfig");
const { getRbacMatrixDashboardEntries } = require("../../lib/rbacMatrixDashboards");

describe("search_bank_branch dashboard config", () => {
  test("is registered with permission key and landing widget", () => {
    expect(isDashboardKey("search_bank_branch")).toBe(true);
    const cfg = getDashboardConfig("search_bank_branch");
    expect(cfg?.permissionKey).toBe("dashboard_search_bank_branch");
    expect(cfg?.landingWidget).toBe(true);
    expect(cfg?.autoGrantForAssignedUnit).toBeUndefined();
  });

  test("runner is registered", () => {
    expect(typeof getDashboardRunner("search_bank_branch")?.loadDashboard).toBe("function");
  });
});

describe("loadDashboard stub", () => {
  test("returns empty rows and hint for authenticated user", async () => {
    const result = await loadDashboard({ id: 1, role: 1 });
    expect(result.ok).toBe(true);
    expect(result.data.rows).toEqual([]);
    expect(result.data.hint).toMatch(/branch code or name/i);
  });

  test("returns 401 without user", async () => {
    const result = await loadDashboard(null);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
  });
});

describe("searchBranches", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("rejects term shorter than minimum length", async () => {
    const result = await searchBranches("a");
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toMatch(/at least/i);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("queries with branch hierarchy joins and LIKE filters", async () => {
    pool.query.mockResolvedValueOnce([
      [
        {
          bankLabel: "SBI",
          hoZoLabel: "HZ1",
          rboRoLabel: "RBO1",
          branchCode: "BR001",
          branchName: "Mysore Main",
          place: "Mysore",
          active: "Y"
        }
      ]
    ]);

    const result = await searchBranches("mysore");
    expect(result.ok).toBe(true);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].branchName).toBe("Mysore Main");
    expect(result.truncated).toBe(false);

    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, values] = pool.query.mock.calls[0];
    expect(String(sql)).toContain("branch_master");
    expect(String(sql)).toContain("rbo_master");
    expect(String(sql)).toContain("ho_zo_master");
    expect(String(sql)).toContain("bank_master");
    expect(String(sql)).toContain("LOWER(TRIM(br.branchCode)) LIKE ?");
    expect(String(sql)).toContain("LOWER(TRIM(br.branchName)) LIKE ?");
    expect(String(sql)).toContain("ORDER BY bank.bankName");
    expect(String(sql)).toContain("LIMIT ?");
    expect(values).toEqual(["%mysore%", "%mysore%", RESULT_LIMIT]);
  });

  test("sets truncated when result count hits limit", async () => {
    const rows = Array.from({ length: RESULT_LIMIT }, (_, i) => ({
      bankLabel: "Bank",
      hoZoLabel: "HZ",
      rboRoLabel: "RBO",
      branchCode: `BR${i}`,
      branchName: `Branch ${i}`,
      place: "City",
      active: "Y"
    }));
    pool.query.mockResolvedValueOnce([rows]);

    const result = await searchBranches("branch");
    expect(result.ok).toBe(true);
    expect(result.rows).toHaveLength(RESULT_LIMIT);
    expect(result.truncated).toBe(true);
  });
});

describe("RBAC matrix", () => {
  test("includes dashboard_search_bank_branch permission key", () => {
    const entries = getRbacMatrixDashboardEntries();
    const entry = entries.find((e) => e.key === "dashboard_search_bank_branch");
    expect(entry).toBeDefined();
    expect(entry?.isDashboard).toBe(true);
    expect(entry?.group).toBe("Dashboards");
  });

  test("MIN_TERM_LENGTH is 2", () => {
    expect(MIN_TERM_LENGTH).toBe(2);
  });
});
