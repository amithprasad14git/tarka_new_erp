// Report registry — maps config key to runReport implementation file.

/**
 * Lookup table: each key in config/reports.js must have a matching import here.
 * Runners export `runReport`; custom reports may also export `buildCustomWorkbook`.
 * See README.md#reports-file-index.
 */

import * as reportNewCaseInwardRegister from "./report_new_case_inward_register.js";
import * as reportBranchRegister from "./report_branch_register.js";
import * as reportPendingCasesOnHand from "./report_pending_cases_on_hand.js";
import * as reportPartRecoveredCases from "./report_part_recovered_cases.js";
import * as reportReturnedCases from "./report_returned_cases.js";
import * as reportSettledCases from "./report_settled_cases.js";
import * as reportSearchLoanAc from "./report_search_loan_ac.js";
import * as reportRegionWiseCumulativeReport from "./report_region_wise_cumulative_report.js";
import * as reportUnitWiseCumulativeReport from "./report_unit_wise_cumulative_report.js";
import * as reportSarfaesiCaseReport from "./report_sarfaesi_case_report.js";
import * as reportAuditLogReport from "./report_audit_log_report.js";
import * as reportAssetsInvestmentsLedger from "./report_assets_investments_ledger.js";
import * as reportCashDepositWithdrawLedger from "./report_cash_deposit_withdraw_ledger.js";
import * as reportAnnualCashDepositWithdrawLedger from "./report_annual_cash_deposit_withdraw_ledger.js";
import * as reportExpenseLedger from "./report_expense_ledger.js";
import * as reportAnnualExpenseLedger from "./report_annual_expense_ledger.js";
import * as reportLoanAccountLedger from "./report_loan_account_ledger.js";
import * as reportCurrentAcTransferLedger from "./report_current_ac_transfer_ledger.js";
import * as reportSuspenseAcLedger from "./report_suspense_ac_ledger.js";
import * as reportInvoiceLedger from "./report_invoice_ledger.js";
import * as reportAnnualInvoiceLedger from "./report_annual_invoice_ledger.js";
import * as reportAnnualInvoicesReceivedLedger from "./report_annual_invoices_received_ledger.js";
import * as reportInvoicesReceivedLedger from "./report_invoices_received_ledger.js";

const REPORT_RUNNERS = {
  report_new_case_inward_register: reportNewCaseInwardRegister,
  report_branch_register: reportBranchRegister,
  report_pending_cases_on_hand: reportPendingCasesOnHand,
  report_part_recovered_cases: reportPartRecoveredCases,
  report_returned_cases: reportReturnedCases,
  report_settled_cases: reportSettledCases,
  report_search_loan_ac: reportSearchLoanAc,
  report_region_wise_cumulative_report: reportRegionWiseCumulativeReport,
  report_unit_wise_cumulative_report: reportUnitWiseCumulativeReport,
  report_sarfaesi_case_report: reportSarfaesiCaseReport,
  report_audit_log_report: reportAuditLogReport,
  report_assets_investments_ledger: reportAssetsInvestmentsLedger,
  report_cash_deposit_withdraw_ledger: reportCashDepositWithdrawLedger,
  report_annual_cash_deposit_withdraw_ledger: reportAnnualCashDepositWithdrawLedger,
  report_expense_ledger: reportExpenseLedger,
  report_annual_expense_ledger: reportAnnualExpenseLedger,
  report_loan_account_ledger: reportLoanAccountLedger,
  report_current_ac_transfer_ledger: reportCurrentAcTransferLedger,
  report_suspense_ac_ledger: reportSuspenseAcLedger,
  report_invoice_ledger: reportInvoiceLedger,
  report_annual_invoice_ledger: reportAnnualInvoiceLedger,
  report_annual_invoices_received_ledger: reportAnnualInvoicesReceivedLedger,
  report_invoices_received_ledger: reportInvoicesReceivedLedger
};

/**
 * @param {string} moduleKey
 * @returns {{ runReport: Function } | null}
 */
export function getReportRunner(moduleKey) {
  return REPORT_RUNNERS[moduleKey] ?? null;
}

