// Module-specific server rules — validations and side effects on save.

/**
 * accountsCashDepositWithdraw — business rules when records are created or updated.
 * Form fields and labels: config/modules.js
 */

// Module-specific file: business rules for Cash Deposit / Withdraw only.

import { modules } from "../../config/modules";
import { rowValueForField } from "../gridRowValue";
import { escapeSqlTableId, escapeSqlTableIdForModuleConfig } from "../sqlModuleTable";
import { toYyyyMmDdForSqlDateField } from "../sqlDateFieldValue";
import {
  assertDateNotInFrozenFinancialYear,
  FREEZE_TRANSACTIONS_LOCKED_MESSAGE,
  shouldEnforceFreezeTransactionsForUser
} from "./freezeTransactionsLock";

/** Must match config/modules.js key and module_number_sequence.module */
export const ACCOUNTS_CASH_DEPOSIT_WITHDRAW_MODULE_KEY = "accounts_cash_deposit_withdraw";

/** Role 2 = unit-scoped operators (matches transfer_case / accounts_assets_investments). */
export const ACCOUNTS_CASH_DEPOSIT_WITHDRAW_UNIT_RESTRICT_ROLE = 2;

function throwValidation(message) {
  throw Object.assign(new Error(message), { code: "ACCOUNTS_CASH_DEPOSIT_WITHDRAW_VALIDATION_FAILED" });
}

async function assertAccountsCashDepositWithdrawDateNotInFrozenFy(conn, parentData, user) {
  // Unit operators cannot post cash movements into a frozen financial year.
  if (!shouldEnforceFreezeTransactionsForUser(user)) return;
  await assertDateNotInFrozenFinancialYear(conn, parentData?.date, {
    onBlocked: () => throwValidation(FREEZE_TRANSACTIONS_LOCKED_MESSAGE)
  });
}

function asPositiveInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizePaymentMode(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/** @returns {'Deposit' | 'Withdraw' | null} */
function normalizeTransactionType(value) {
  const s = String(value ?? "").trim();
  if (s === "Deposit" || s === "Withdraw") return s;
  return null;
}

/** NPA Current AC is always required for this module (all payment modes including Cash). */
export function assertAccountsCashDepositWithdrawNpaCurrentAcRule(parentData) {
  const caId = asPositiveInt(parentData?.npaCurrentAc);
  if (!caId) {
    throwValidation("NPA Current AC is required.");
  }
}

/**
 * Cheque mode: chequeNo and chequeDate required (server-side).
 */
export function assertAccountsCashDepositWithdrawChequeFields(parentData) {
  const pm = normalizePaymentMode(parentData?.paymentMode);
  if (pm !== "cheque") return;

  const chequeNo = String(parentData?.chequeNo ?? "").trim();
  if (!chequeNo) {
    throwValidation("Cheque No is required when Payment Mode is Cheque.");
  }
  const chequeDateYmd = toYyyyMmDdForSqlDateField(parentData?.chequeDate);
  if (!chequeDateYmd) {
    throwValidation("Cheque Date is required when Payment Mode is Cheque.");
  }
}

export function assertAccountsCashDepositWithdrawTransactionType(parentData) {
  if (!normalizeTransactionType(parentData?.transactionType)) {
    throwValidation("Transaction Type must be Deposit or Withdraw.");
  }
}

const ALLOWED_PAYMENT_MODES = new Set(["card", "cheque", "cash", "upi"]);

export function assertAccountsCashDepositWithdrawPaymentMode(parentData) {
  const pm = normalizePaymentMode(parentData?.paymentMode);
  if (!pm) {
    throwValidation("Payment Mode is required.");
  }
  if (!ALLOWED_PAYMENT_MODES.has(pm)) {
    throwValidation("Payment Mode is invalid.");
  }
}

/**
 * Role 2: unit must match session unit; npaCurrentAc (when present) must belong to current_account_master for that unit.
 */
export async function assertAccountsCashDepositWithdrawRole2UnitAndCurrentAc(conn, parentData, user) {
  // Unit operators may only use their branch and its current accounts.
  const role = Number(user?.role);
  if (!Number.isFinite(role) || role !== ACCOUNTS_CASH_DEPOSIT_WITHDRAW_UNIT_RESTRICT_ROLE) return;

  const sessionUnitId = asPositiveInt(user?.unit);
  if (sessionUnitId == null) return;

  const rowUnitId = asPositiveInt(parentData?.unit);
  if (rowUnitId !== sessionUnitId) {
    throwValidation("Unit must match your assigned unit.");
  }

  const caId = asPositiveInt(parentData?.npaCurrentAc);
  if (!caId) return;

  const cam = escapeSqlTableIdForModuleConfig(modules.current_account_master);
  const [rows] = await conn.query(
    `SELECT id FROM ${cam} WHERE id = ? AND unit = ? LIMIT 1`,
    [caId, sessionUnitId]
  );
  if (!rows?.length) {
    throwValidation("NPA Current AC must belong to your unit’s current account list.");
  }
}

async function resolveYearCodeByDate(conn, bizDate) {
  const ymd = toYyyyMmDdForSqlDateField(bizDate);
  if (!ymd) {
    throwValidation("Date is required to generate Voucher No.");
  }
  const fyTable = escapeSqlTableIdForModuleConfig(modules.financial_year_master);
  const [rows] = await conn.query(
    `SELECT yearCode FROM ${fyTable} WHERE ? BETWEEN startDate AND endDate LIMIT 1`,
    [ymd]
  );
  const yearCode = String(rowValueForField(rows?.[0] || {}, "yearCode") ?? "").trim();
  if (!yearCode) {
    throwValidation("No Financial Year found for selected Date.");
  }
  return yearCode;
}

function voucherLeadForTransactionType(tt) {
  // Deposit and withdraw share one module but use separate serial prefixes per FY.
  if (tt === "Deposit") return "C/DP";
  if (tt === "Withdraw") return "C/WD";
  return null;
}

/**
 * Deposit: C/DP/&lt;yearCode&gt;/&lt;4-digit serial&gt;
 * Withdraw: C/WD/&lt;yearCode&gt;/&lt;4-digit serial&gt;
 */
export async function assignAccountsCashDepositWithdrawVoucherNo(conn, recordId) {
  // --- Voucher: C/DP or C/WD + year code + 4-digit serial (after create) ---
  const mod = modules.accounts_cash_deposit_withdraw;
  if (!mod?.table) {
    throwValidation("accounts_cash_deposit_withdraw module config missing.");
  }
  const table = escapeSqlTableIdForModuleConfig(mod);
  const seqTable = escapeSqlTableId("module_number_sequence");

  const [rows] = await conn.query(`SELECT id, date, transactionType FROM ${table} WHERE id = ? LIMIT 1`, [recordId]);
  if (!rows?.length) {
    throwValidation("Cash Deposit / Withdraw row was not found while generating Voucher No.");
  }

  const tt = normalizeTransactionType(rowValueForField(rows[0], "transactionType"));
  if (!tt) {
    throwValidation("Transaction Type is required to generate Voucher No.");
  }
  const lead = voucherLeadForTransactionType(tt);
  if (!lead) {
    throwValidation("Transaction Type must be Deposit or Withdraw for Voucher No.");
  }

  const yearCode = await resolveYearCodeByDate(conn, rowValueForField(rows[0], "date"));
  const sequencePrefix = `${lead}/${yearCode}`;

  await conn.query(
    `INSERT INTO ${seqTable} (module, prefix, lastNumber) VALUES (?, ?, 0)
     ON DUPLICATE KEY UPDATE lastNumber = lastNumber`,
    [ACCOUNTS_CASH_DEPOSIT_WITHDRAW_MODULE_KEY, sequencePrefix]
  );

  const [seqRows] = await conn.query(`SELECT lastNumber FROM ${seqTable} WHERE module = ? AND prefix = ? FOR UPDATE`, [
    ACCOUNTS_CASH_DEPOSIT_WITHDRAW_MODULE_KEY,
    sequencePrefix
  ]);
  if (!seqRows?.length) {
    throwValidation("Cash Deposit / Withdraw sequence row missing.");
  }

  const last = Number(rowValueForField(seqRows[0], "lastNumber"));
  const next = Number.isFinite(last) ? last + 1 : 1;
  const voucherNo = `${lead}/${yearCode}/${String(next).padStart(4, "0")}`;

  await conn.query(`UPDATE ${seqTable} SET lastNumber = ? WHERE module = ? AND prefix = ?`, [
    next,
    ACCOUNTS_CASH_DEPOSIT_WITHDRAW_MODULE_KEY,
    sequencePrefix
  ]);
  await conn.query(`UPDATE ${table} SET voucherNo = ? WHERE id = ? AND (voucherNo IS NULL OR TRIM(voucherNo) = '')`, [
    voucherNo,
    recordId
  ]);
}

export async function validateAccountsCashDepositWithdrawBeforeWrite(conn, { parentData, user }) {
  // --- FY freeze, deposit/withdraw type, payment mode, NPA (always), cheque, unit scope ---
  await assertAccountsCashDepositWithdrawDateNotInFrozenFy(conn, parentData, user);
  assertAccountsCashDepositWithdrawTransactionType(parentData);
  assertAccountsCashDepositWithdrawPaymentMode(parentData);
  assertAccountsCashDepositWithdrawNpaCurrentAcRule(parentData);
  assertAccountsCashDepositWithdrawChequeFields(parentData);
  await assertAccountsCashDepositWithdrawRole2UnitAndCurrentAc(conn, parentData, user);
}

export async function applyAccountsCashDepositWithdrawBeforeWrite(conn, { oldRow, merged, user }) {
  const parentData = oldRow ? { ...oldRow, ...merged } : merged;
  await validateAccountsCashDepositWithdrawBeforeWrite(conn, { parentData, user });
}

