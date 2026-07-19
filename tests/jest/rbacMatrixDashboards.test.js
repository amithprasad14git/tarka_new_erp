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

  test("matrix entries are ordered modules then reports then dashboards", () => {
    const all = getRbacMatrixModuleEntries();
    const firstReport = all.findIndex((e) => e.isReport);
    const firstDashboard = all.findIndex((e) => e.isDashboard);
    const lastCrud = all.reduce((acc, e, i) => (!e.isReport && !e.isDashboard ? i : acc), -1);
    const lastReport = all.reduce((acc, e, i) => (e.isReport ? i : acc), -1);

    expect(firstReport).toBeGreaterThan(-1);
    expect(firstDashboard).toBeGreaterThan(-1);
    expect(lastCrud).toBeGreaterThan(-1);
    expect(firstReport).toBeGreaterThan(lastCrud);
    expect(firstDashboard).toBeGreaterThan(lastReport);

    // No type should appear after a later section has started.
    for (let i = 0; i < all.length; i++) {
      const e = all[i];
      if (i < firstReport) {
        expect(e.isReport).toBeFalsy();
        expect(e.isDashboard).toBeFalsy();
      } else if (i < firstDashboard) {
        expect(e.isReport).toBe(true);
        expect(e.isDashboard).toBeFalsy();
      } else {
        expect(e.isDashboard).toBe(true);
      }
    }
  });

  test("isDashboardPermissionKey recognizes dashboard permission keys", () => {
    expect(isDashboardPermissionKey("dashboard_unit_wise_recovery_target")).toBe(true);
    expect(isDashboardPermissionKey("dashboard_search_bank_branch")).toBe(true);
    expect(isDashboardPermissionKey("dashboard_invoice_collections")).toBe(true);
    expect(isDashboardPermissionKey("employee_master")).toBe(false);
  });
});

