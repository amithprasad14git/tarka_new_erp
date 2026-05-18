/**
 * =============================================================================
 * After-create hooks (runs before the database “saves for good”)
 * =============================================================================
 * Generic CRUD only runs INSERT. Some screens need extra work in the same breath,
 * e.g. stamping a Case No. Those steps run here on the same connection and inside
 * the same transaction: if anything fails, the new row is rolled back too—no
 * half-saved records.
 *
 * Convention: each module’s custom server logic lives in ONE file under lib/modules/
 * (e.g. newCaseInward.js). Import only its entry point here — do not split one
 * module across multiple lib/modules/<module>*.js files.
 * =============================================================================
 */
import { assignNewCaseInwardCaseNo } from "./modules/newCaseInward";
import { assignPublicNoticeRefNo } from "./modules/publicNotice";
import { assignReturnCaseRefNo } from "./modules/returnCase";
import { assignSarfaesiCaseStatusUpdateRefNo } from "./modules/sarfaesiCaseStatusUpdate";
import { assignTransferCaseRefNo } from "./modules/transferCase";
import { assignAccountsAssetsInvestmentsVoucherNo } from "./modules/accountsAssetsInvestments";
import { assignAccountsCashDepositWithdrawVoucherNo } from "./modules/accountsCashDepositWithdraw";
import { assignAccountsCurrentAcTransferVoucherNo } from "./modules/accountsCurrentAcTransfer";
import { assignAccountsExpenseVoucherVoucherNo } from "./modules/accountsExpenseVoucher";
import { assignAccountsLoanAcVoucherNo } from "./modules/accountsLoanAc";
import { assignAccountsSuspenseEntryVoucherNo } from "./modules/accountsSuspenseEntry";
import { assignRecoveryInvoiceInvoiceNo } from "./modules/recoveryInvoice";
import { assignSarfaesiInvoiceInvoiceNo } from "./modules/sarfaesiInvoice";
import { assignVehicleInvoiceInvoiceNo } from "./modules/vehicleInvoice";
import { assignInvoicesReceivedRefNo } from "./modules/invoicesReceived";

/**
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {string} moduleKey Key from config/modules.js (URL / API module name)
 * @param {number} recordId New row’s primary key from INSERT
 */
export async function runAfterCreateInTransaction(conn, moduleKey, recordId) {
  if (moduleKey === "new_case_inward") {
    await assignNewCaseInwardCaseNo(conn, recordId);
    return;
  }
  if (moduleKey === "transfer_case") {
    await assignTransferCaseRefNo(conn, recordId);
    return;
  }
  if (moduleKey === "public_notice") {
    await assignPublicNoticeRefNo(conn, recordId);
    return;
  }
  if (moduleKey === "return_case") {
    await assignReturnCaseRefNo(conn, recordId);
    return;
  }
  if (moduleKey === "sarfaesi_case_status_update") {
    await assignSarfaesiCaseStatusUpdateRefNo(conn, recordId);
    return;
  }
  if (moduleKey === "accounts_assets_investments") {
    await assignAccountsAssetsInvestmentsVoucherNo(conn, recordId);
    return;
  }
  if (moduleKey === "accounts_cash_deposit_withdraw") {
    await assignAccountsCashDepositWithdrawVoucherNo(conn, recordId);
    return;
  }
  if (moduleKey === "accounts_current_ac_transfer") {
    await assignAccountsCurrentAcTransferVoucherNo(conn, recordId);
    return;
  }
  if (moduleKey === "accounts_expense_voucher") {
    await assignAccountsExpenseVoucherVoucherNo(conn, recordId);
    return;
  }
  // Loan Account: stamp voucherNo — Receipt → LN/CR/<FY>/####, Payment → LN/DR/<FY>/#### (see accountsLoanAc.js).
  if (moduleKey === "accounts_loan_ac") {
    await assignAccountsLoanAcVoucherNo(conn, recordId);
    return;
  }
  // Suspense Entry: stamp voucherNo → SUSP/<FY>/#### (see accountsSuspenseEntry.js).
  if (moduleKey === "accounts_suspense_entry") {
    await assignAccountsSuspenseEntryVoucherNo(conn, recordId);
    return;
  }
  if (moduleKey === "recovery_invoice") {
    await assignRecoveryInvoiceInvoiceNo(conn, recordId);
    return;
  }
  if (moduleKey === "sarfaesi_invoice") {
    await assignSarfaesiInvoiceInvoiceNo(conn, recordId);
    return;
  }
  if (moduleKey === "vehicle_invoice") {
    await assignVehicleInvoiceInvoiceNo(conn, recordId);
    return;
  }
  if (moduleKey === "invoices_received") {
    await assignInvoicesReceivedRefNo(conn, recordId);
    return;
  }
}
