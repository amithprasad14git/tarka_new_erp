// Test file — dashboard keys appear in RBAC permissions matrix.

/**
 * Ensures every config/dashboards.js permissionKey shows in User Permissions matrix.
 * Guide: README.md#5a-landing-dashboards
 */

import { getRbacMatrixModuleEntries } from "../../lib/rbacMatrixModules";
import { getRbacMatrixDashboardEntries } from "../../lib/rbacMatrixDashboards";
import { isDashboardPermissionKey } from "../../lib/dashboardConfig";

describe("rbacMatrixDashboards", () => {
  test("includes unit_wise_recovery_target permission key", () => {
    const entries = getRbacMatrixDashboardEntries();
    expect(entries.some((e) => e.key === "dashboard_unit_wise_recovery_target")).toBe(true);
    expect(entries.some((e) => e.key === "dashboard_search_bank_branch")).toBe(true);
    expect(entries.some((e) => e.key === "dashboard_invoice_collections")).toBe(true);
    expect(entries.every((e) => e.isDashboard === true)).toBe(true);
  });

  test("matrix module entries include dashboard group", () => {
    const all = getRbacMatrixModuleEntries();
    const dash = all.filter((e) => e.isDashboard);
    expect(dash.length).toBeGreaterThanOrEqual(1);
    expect(dash.some((e) => e.group === "Dashboards")).toBe(true);
  });

  test("isDashboardPermissionKey recognizes dashboard permission keys", () => {
    expect(isDashboardPermissionKey("dashboard_unit_wise_recovery_target")).toBe(true);
    expect(isDashboardPermissionKey("dashboard_search_bank_branch")).toBe(true);
    expect(isDashboardPermissionKey("dashboard_invoice_collections")).toBe(true);
    expect(isDashboardPermissionKey("employee_master")).toBe(false);
  });
});

