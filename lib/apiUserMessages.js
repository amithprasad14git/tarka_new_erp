/**
 * =============================================================================
 * API USER MESSAGES — Layman error copy keyed by user action
 * =============================================================================
 * Server and client share these strings so list/save/report failures read the
 * same way everywhere. Pair each action with an optional `*Db` variant when the
 * failure is database connectivity. Technical detail belongs in `hint` from
 * getDbErrorHint (server) — not in these messages.
 * =============================================================================
 */

export const API_USER_MESSAGES = {
  loadList: "We could not load the list. Please try again or contact your administrator.",
  loadListDb:
    "We could not load the list. The server could not connect to the database. Please contact your administrator.",
  loadRecord: "We could not open this record. Please try again.",
  loadRecordDb:
    "We could not open this record. The server could not connect to the database. Please contact your administrator.",
  saveRecord: "We could not save your changes. Please try again or contact your administrator.",
  saveRecordDb:
    "We could not save your changes. The server could not connect to the database. Please contact your administrator.",
  deleteRecord: "We could not delete this record. Please try again.",
  deleteRecordDb:
    "We could not delete this record. The server could not connect to the database. Please contact your administrator.",
  runReport: "We could not generate the report. Please try again.",
  runReportDb:
    "We could not generate the report. The server could not connect to the database. Please contact your administrator.",
  exportReport: "We could not download the Excel file. Please try again.",
  exportReportDb:
    "We could not download the Excel file. The server could not connect to the database. Please contact your administrator.",
  loadLookup: "We could not load dropdown options. The server may be unavailable.",
  loadLookupDb:
    "We could not load dropdown options. The server could not connect to the database. Please contact your administrator.",
  loadPermissions: "We could not verify your access for this screen. Please refresh the page.",
  loadPermissionsDb:
    "We could not verify your access for this screen. The server could not connect to the database. Please refresh the page or contact your administrator.",
  savePermissions: "We could not save permission changes. Please try again.",
  savePermissionsDb:
    "We could not save permission changes. The server could not connect to the database. Please contact your administrator.",
  downloadPdf: "We could not prepare the PDF. Please try again.",
  downloadPdfDb:
    "We could not prepare the PDF. The server could not connect to the database. Please contact your administrator.",
  changePassword: "We could not change your password. Please try again.",
  changePasswordDb:
    "We could not change your password. The server could not connect to the database. Please contact your administrator.",
  loginFailed: "Sign-in failed on the server. Please try again or contact your administrator.",
  loginFailedDb: "Sign-in failed. The server could not connect to the database. Please contact your administrator.",
  loginConfig:
    "Server is missing database configuration. Set DB_HOST, DB_USER, DB_PASS, and DB_NAME in environment variables.",
  loadNciLookups: "We could not load New Case Inward lookup data. Please try again.",
  loadNciLookupsDb:
    "We could not load New Case Inward lookup data. The server could not connect to the database. Please contact your administrator.",
  loadLoanAccountRule: "We could not load the loan account rule for this branch. Please try again.",
  loadLoanAccountRuleDb:
    "We could not load the loan account rule. The server could not connect to the database. Please contact your administrator.",
  loadTransactionControl: "We could not load transaction control settings. Please try again.",
  loadTransactionControlDb:
    "We could not load transaction control settings. The server could not connect to the database. Please contact your administrator.",
  enrichAuditCompare: "We could not load comparison details for this audit entry. Please try again.",
  enrichAuditCompareDb:
    "We could not load comparison details. The server could not connect to the database. Please contact your administrator.",
  loadMatrix: "We could not load the permissions matrix. Please try again.",
  loadMatrixDb:
    "We could not load the permissions matrix. The server could not connect to the database. Please contact your administrator.",
  loadUsers: "We could not load the user list. Please try again.",
  loadUsersDb:
    "We could not load the user list. The server could not connect to the database. Please contact your administrator.",
  networkUnreachable:
    "We could not reach the server. Check your internet connection and try again.",
  sessionExpired: "Your session has expired. Please sign in again.",
  sessionInactive: "You were signed out due to inactivity. Please sign in again.",
  sessionReplaced:
    "You were signed out because you signed in on another device or browser. Please sign in again.",
  weatherUnavailable: "Weather unavailable",
  pdfLibraryMissing:
    "PDF library is not installed on the server. Please contact your administrator.",
  genericServer: "Something went wrong on the server. Please try again or contact your administrator.",
  genericServerDb:
    "Something went wrong. The server could not connect to the database. Please contact your administrator."
};

/**
 * Resolve a keyed layman message; unknown keys fall back to genericServer.
 * @param {keyof typeof API_USER_MESSAGES} key
 * @returns {string}
 */
export function apiUserMessage(key) {
  return API_USER_MESSAGES[key] ?? API_USER_MESSAGES.genericServer;
}
