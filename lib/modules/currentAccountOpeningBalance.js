// Module-specific server rules — validations on save.

/**
 * Current AC OP Balance — FY freeze on effective date (role 2 only).
 * Form fields: config/modules.js → current_account_opening_balance
 */

import {
  assertDateNotInFrozenFinancialYear,
  FREEZE_TRANSACTIONS_LOCKED_MESSAGE,
  shouldEnforceFreezeTransactionsForUser
} from "./freezeTransactionsLock";

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

export async function validateCurrentAccountOpeningBalanceBeforeWrite(conn, { parentData, user }) {
  await assertEffectiveDateNotInFrozenFy(conn, parentData, user);
}

export async function applyCurrentAccountOpeningBalanceBeforeWrite(conn, { oldRow, merged, user }) {
  const parentData = oldRow ? { ...oldRow, ...merged } : merged;
  await validateCurrentAccountOpeningBalanceBeforeWrite(conn, { parentData, user });
}
