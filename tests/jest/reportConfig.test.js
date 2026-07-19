// Test file — report config helpers.

import { isReportKey, getReportConfig } from "../../lib/reportConfig";

describe("reportConfig", () => {
  test("recognizes report keys", () => {
    expect(isReportKey("report_new_case_inward_register")).toBe(true);
    expect(isReportKey("report_branch_register")).toBe(true);
    expect(isReportKey("report_pending_cases_on_hand")).toBe(true);
    expect(isReportKey("report_part_recovered_cases")).toBe(true);
    expect(isReportKey("report_returned_cases")).toBe(true);
    expect(isReportKey("report_settled_cases")).toBe(true);
    expect(isReportKey("report_search_loan_ac")).toBe(true);
    expect(isReportKey("report_region_wise_cumulative_report")).toBe(true);
    expect(isReportKey("report_unit_wise_cumulative_report")).toBe(true);
    expect(isReportKey("report_sarfaesi_case_report")).toBe(true);
    expect(isReportKey("report_audit_log_report")).toBe(true);
    expect(isReportKey("report_assets_investments_ledger")).toBe(true);
    expect(isReportKey("report_cash_deposit_withdraw_ledger")).toBe(true);
    expect(isReportKey("report_expense_ledger")).toBe(true);
    expect(isReportKey("report_loan_account_ledger")).toBe(true);
    expect(isReportKey("report_current_ac_transfer_ledger")).toBe(true);
    expect(isReportKey("report_suspense_ac_ledger")).toBe(true);
    expect(isReportKey("report_invoice_ledger")).toBe(true);
    expect(isReportKey("report_invoices_received_ledger")).toBe(true);
    expect(isReportKey("new_case_inward")).toBe(false);
  });

  test("getReportConfig returns report block merged with export theme", () => {
    const cfg = getReportConfig("report_new_case_inward_register");
    expect(cfg?.label).toMatch(/Case Inward Register/i);
    expect(Array.isArray(cfg?.columns)).toBe(true);
    expect(cfg?.reportStyle?.zebra?.odd).toBe("#DCE6EF");
    expect(cfg?.reportLayout?.logoPath).toMatch(/npa_full_transparent_bg/);
    expect(cfg?.exportTheme?.excel?.fontSize).toBe(9);
  });
});

