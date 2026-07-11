/**
 * =============================================================================
 * CURRENT AC OPENING BALANCE — FY freeze on effective date
 * =============================================================================
 * Unit operators (role 2) cannot post opening balances dated in a frozen
 * financial year. Admins may still save for corrections. Wired via CRUD
 * beforeWrite adapters.
 * =============================================================================
 */

import {
  assertDateNotInFrozenFinancialYear,
  FREEZE_TRANSACTIONS_LOCKED_MESSAGE,
  shouldEnforceFreezeTransactionsForUser
} from "./freezeTransactionsLock";

/** Module key for current_account_opening_balance. */
export const CURRENT_ACCOUNT_OPENING_BALANCE_MODULE_KEY = "current_account_opening_balance";

function throwValidation(message) {
  throw Object.assign(new Error(message), {
    code: "CURRENT_ACCOUNT_OPENING_BALANCE_VALIDATION_FAILED"
  });
}

async function assertEffectiveDateNotInFrozenFy(conn, parentData, user) {
  if (!shouldEnforceFreezeTransactionsForUser(user)) return;
  await assertDateNotInFrozenFinancialYear(conn, parentData?.effectiveDate, {
    onBlocked: () => throwValidation(FREEZE_TRANSACTIONS_LOCKED_MESSAGE)
  });
}

/**
 * Validate opening-balance save: block role 2 when effectiveDate is in a frozen FY.
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {{ parentData: object, user: object }} ctx
 */
export async function validateCurrentAccountOpeningBalanceBeforeWrite(conn, { parentData, user }) {
  await assertEffectiveDateNotInFrozenFy(conn, parentData, user);
}

/**
 * Merge old+new row then run freeze validation (CRUD beforeWrite entry point).
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {{ oldRow?: object | null, merged: object, user: object }} ctx
 */
export async function applyCurrentAccountOpeningBalanceBeforeWrite(conn, { oldRow, merged, user }) {
  const parentData = oldRow ? { ...oldRow, ...merged } : merged;
  await validateCurrentAccountOpeningBalanceBeforeWrite(conn, { parentData, user });
}

