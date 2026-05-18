/**
 * Financial year “transaction freeze” — shared helper for many modules.
 *
 * Layman terms: in Financial Year Master you can mark a year as frozen (`freezeTransactions = Yes`).
 * When frozen, **unit operators** (role 2) cannot post new transactions dated in that year.
 * **Admins** (role 1) can still save — use this for corrections or year-end adjustments.
 *
 * Used by: transfer_case, public_notice, return_case, sarfaesi_case_status_update,
 * accounts_* modules, recovery/sarfaesi/vehicle invoices (via each module’s beforeWrite).
 * New Case Inward has its own similar check on case status date (all non-admin users).
 */

import { modules } from "../../config/modules";
import { rowValueForField } from "../gridRowValue";
import { escapeSqlTableIdForModuleConfig } from "../sqlModuleTable";
import { toYyyyMmDdForSqlDateField } from "../sqlDateFieldValue";

export const FREEZE_TRANSACTIONS_LOCKED_MESSAGE =
  "Transactions are locked for the selected financial year. Please contact the administrator.";

/** Role 2 = unit operators; role 1 (admin) and other roles are not blocked by FY freeze. */
export function shouldEnforceFreezeTransactionsForUser(user) {
  return Number(user?.role) === 2;
}

function normalizeAllowFlag(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/**
 * @param {{ onBlocked: () => never }} options
 */
export async function assertDateNotInFrozenFinancialYear(conn, date, { onBlocked }) {
  const ymd = toYyyyMmDdForSqlDateField(date);
  if (!ymd) return;

  const fy = modules.financial_year_master;
  if (!fy?.table) return;

  const t = escapeSqlTableIdForModuleConfig(fy);
  const [rows] = await conn.query(
    `SELECT freezeTransactions FROM ${t} WHERE ? BETWEEN startDate AND endDate`,
    [ymd]
  );

  const hasFrozenYear = Array.isArray(rows)
    ? rows.some((r) => normalizeAllowFlag(rowValueForField(r, "freezeTransactions")) === "yes")
    : false;
  if (!hasFrozenYear) return;

  onBlocked();
}
