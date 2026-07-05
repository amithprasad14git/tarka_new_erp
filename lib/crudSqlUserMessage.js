/**
 * Maps MySQL errors from CRUD writes to layman-facing API responses.
 */

import { getDbErrorHint } from "./dbConnectionError";
import { apiUserMessage } from "./apiUserMessages";

const CRUD_VALIDATION_ERROR_CODES = new Set([
  "CASE_NO_PREFIX_UNRESOLVED",
  "CASE_NO_PREFIX_EMPTY",
  "LOAN_CATEGORY_MISSING",
  "LOAN_CATEGORY_CASE_NO_MAP_MISSING",
  "LOAN_CATEGORY_CASE_NO_UNKNOWN",
  "CASE_NO_SEQUENCE_ROW",
  "CHILD_ROWS_INVALID",
  "NCI_VALIDATION_FAILED",
  "TRANSFER_CASE_VALIDATION_FAILED",
  "PUBLIC_NOTICE_VALIDATION_FAILED",
  "RETURN_CASE_VALIDATION_FAILED",
  "SARFAESI_CASE_STATUS_UPDATE_VALIDATION_FAILED",
  "INVOICES_RECEIVED_VALIDATION_FAILED",
  "ACCOUNTS_ASSETS_INVESTMENTS_VALIDATION_FAILED",
  "ACCOUNTS_CASH_DEPOSIT_WITHDRAW_VALIDATION_FAILED",
  "ACCOUNTS_CURRENT_AC_TRANSFER_VALIDATION_FAILED",
  "ACCOUNTS_EXPENSE_VOUCHER_VALIDATION_FAILED",
  "ACCOUNTS_LOAN_AC_VALIDATION_FAILED",
  "ACCOUNTS_SUSPENSE_ENTRY_VALIDATION_FAILED",
  "USER_PERMISSIONS_VALIDATION_FAILED",
  "USERS_VALIDATION_FAILED",
  "RECOVERY_INVOICE_VALIDATION_FAILED",
  "SARFAESI_INVOICE_VALIDATION_FAILED",
  "VEHICLE_INVOICE_VALIDATION_FAILED",
  "INVOICE_CASE_FINAL_BLOCKED"
]);

const SQL_COLUMN_LABELS = {
  caseNo: "Case No",
  npaCurrentAc: "NPA Current AC",
  billToUnit: "Bill to Unit",
  unit: "Unit",
  date: "Date"
};

/**
 * @param {unknown} code
 * @returns {boolean}
 */
export function isCrudValidationErrorCode(code) {
  return CRUD_VALIDATION_ERROR_CODES.has(code);
}

/**
 * @param {unknown} error
 * @returns {{ status: number, error: string, hint?: string }}
 */
export function userMessageFromSqlError(error) {
  const code = error?.code;
  const sqlMessage = String(error?.sqlMessage || error?.message || "");

  if (code === "ER_BAD_NULL_ERROR") {
    const colMatch = sqlMessage.match(/Column '([^']+)' cannot be null/i);
    if (colMatch) {
      const col = colMatch[1];
      const label = SQL_COLUMN_LABELS[col] || col;
      return { status: 400, error: `${label} is required.` };
    }
    return {
      status: 400,
      error: "A required value was missing. Please check all required fields."
    };
  }

  if (code === "ER_NO_REFERENCED_ROW_2") {
    return {
      status: 400,
      error: "A selected lookup value is invalid. Check your selections and try again."
    };
  }

  if (code === "ER_DUP_ENTRY") {
    return { status: 400, error: "This record already exists." };
  }

  const hint = getDbErrorHint(error);
  const errorText = apiUserMessage(hint ? "saveRecordDb" : "saveRecord");
  return hint ? { status: 500, error: errorText, hint } : { status: 500, error: errorText };
}

/**
 * @param {unknown} error
 * @returns {{ status: number, body: { error: string, hint?: string } } | null}
 */
export function resolveCrudWriteErrorResponse(error) {
  if (isCrudValidationErrorCode(error?.code)) {
    return { status: 400, body: { error: String(error.message || "Validation failed.") } };
  }
  const mapped = userMessageFromSqlError(error);
  return {
    status: mapped.status,
    body: mapped.hint ? { error: mapped.error, hint: mapped.hint } : { error: mapped.error }
  };
}
