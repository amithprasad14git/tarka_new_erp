import {
  CASE_REPORT_UNIT_LOCK_KEYS,
  getLockedReportUnitId
} from "../../lib/reports/reportUnitFilterLock";

describe("getLockedReportUnitId", () => {
  test("returns session unit for role 2 on a case report key", () => {
    expect(getLockedReportUnitId("report_new_case_inward_register", 2, 7)).toBe(7);
  });

  test("returns null for admin role 1", () => {
    expect(getLockedReportUnitId("report_new_case_inward_register", 1, 7)).toBeNull();
  });

  test("returns null when unit is missing", () => {
    expect(getLockedReportUnitId("report_settled_cases", 2, null)).toBeNull();
    expect(getLockedReportUnitId("report_settled_cases", 2, "")).toBeNull();
  });

  test("returns null for accounts report keys", () => {
    expect(getLockedReportUnitId("report_expense_ledger", 2, 7)).toBeNull();
    expect(getLockedReportUnitId("report_invoice_ledger", 2, 7)).toBeNull();
  });

  test("Unit Wise Cummulative is not unit-locked", () => {
    expect(CASE_REPORT_UNIT_LOCK_KEYS.has("report_unit_wise_cumulative_report")).toBe(false);
    expect(getLockedReportUnitId("report_unit_wise_cumulative_report", 2, 7)).toBeNull();
  });

  test("case lock set includes eight case report keys", () => {
    expect(CASE_REPORT_UNIT_LOCK_KEYS.size).toBe(8);
    expect(CASE_REPORT_UNIT_LOCK_KEYS.has("report_sarfaesi_case_report")).toBe(true);
    expect(CASE_REPORT_UNIT_LOCK_KEYS.has("report_region_wise_cumulative_report")).toBe(true);
  });
});
