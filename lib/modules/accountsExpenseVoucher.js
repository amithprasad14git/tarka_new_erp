// Module-specific server rules — validations and side effects on save.

/**
 * accountsExpenseVoucher — business rules when records are created or updated.
 * Form fields and labels: config/modules.js
 */

// Module-specific file: Expense voucher business rules (mirror accounts_assets_investments patterns).

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
export const ACCOUNTS_EXPENSE_VOUCHER_MODULE_KEY = "accounts_expense_voucher";

/** Role 2 = unit-scoped operators (same convention as accounts_assets_investments). */
export const ACCOUNTS_EXPENSE_VOUCHER_UNIT_RESTRICT_ROLE = 2;

/**
 * Align with `accounts_expense_voucher.postCreateAck` in config/modules.js.
 */
export const ACCOUNTS_EXPENSE_VOUCHER_POST_CREATE_ACK_CONFIG = {
  field: "voucherNo",
  title: "Expense Voucher saved",
  hint: "Your voucher number is shown below. Continue to enter another record.",
  valueLabel: "Voucher No",
  showPrintPdf: false,
  showCopyButton: false
};

function throwAccountsExpenseVoucherValidation(message) {
  throw Object.assign(new Error(message), { code: "ACCOUNTS_EXPENSE_VOUCHER_VALIDATION_FAILED" });
}

async function assertAccountsExpenseVoucherDateNotInFrozenFy(conn, parentData, user) {
  // Unit operators cannot book expenses in a frozen financial year.
  if (!shouldEnforceFreezeTransactionsForUser(user)) return;
  await assertDateNotInFrozenFinancialYear(conn, parentData?.date, {
    onBlocked: () => throwAccountsExpenseVoucherValidation(FREEZE_TRANSACTIONS_LOCKED_MESSAGE)
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

const ALLOWED_EXPENSE_PAYMENT_MODES = new Set(["card", "cheque", "cash", "upi"]);

/** Require a known expense payment mode (card / cheque / cash / upi). */
export function assertAccountsExpenseVoucherPaymentMode(parentData) {
  const pm = normalizePaymentMode(parentData?.paymentMode);
  if (!pm) {
    throwAccountsExpenseVoucherValidation("Payment Mode is required.");
  }
  if (!ALLOWED_EXPENSE_PAYMENT_MODES.has(pm)) {
    throwAccountsExpenseVoucherValidation("Payment Mode is invalid.");
  }
}

/**
 * Cash: NPA Current AC must be empty. Other modes: NPA Current AC is required.
 */
export function assertAccountsExpenseVoucherNpaCurrentAcRule(parentData) {
  const pm = normalizePaymentMode(parentData?.paymentMode);
  const caId = asPositiveInt(parentData?.npaCurrentAc);

  if (pm === "cash") {
    if (caId != null) {
      throwAccountsExpenseVoucherValidation(
        "NPA Current AC must be empty when Payment Mode is Cash."
      );
    }
    return;
  }

  if (!caId) {
    throwAccountsExpenseVoucherValidation(
      "NPA Current AC is required unless Payment Mode is Cash."
    );
  }
}

/**
 * Cheque mode: chequeNo and chequeDate required (server-side).
 */
export function assertAccountsExpenseVoucherChequeFields(parentData) {
  const pm = normalizePaymentMode(parentData?.paymentMode);
  if (pm !== "cheque") return;

  const chequeNo = String(parentData?.chequeNo ?? "").trim();
  if (!chequeNo) {
    throwAccountsExpenseVoucherValidation("Cheque No is required when Payment Mode is Cheque.");
  }
  const chequeDateYmd = toYyyyMmDdForSqlDateField(parentData?.chequeDate);
  if (!chequeDateYmd) {
    throwAccountsExpenseVoucherValidation("Cheque Date is required when Payment Mode is Cheque.");
  }
}

/**
 * Role 2: unit must match session unit; npaCurrentAc must belong to current_account_master for that unit.
 */
export async function assertAccountsExpenseVoucherRole2UnitAndCurrentAc(conn, parentData, user) {
  // Unit operators may only use their branch and its current accounts.
  const role = Number(user?.role);
  if (!Number.isFinite(role) || role !== ACCOUNTS_EXPENSE_VOUCHER_UNIT_RESTRICT_ROLE) return;

  const sessionUnitId = asPositiveInt(user?.unit);
  if (sessionUnitId == null) return;

  const rowUnitId = asPositiveInt(parentData?.unit);
  if (rowUnitId !== sessionUnitId) {
    throwAccountsExpenseVoucherValidation("Unit must match your assigned unit.");
  }

  const caId = asPositiveInt(parentData?.npaCurrentAc);
  if (!caId) return;

  const cam = escapeSqlTableIdForModuleConfig(modules.current_account_master);
  const [rows] = await conn.query(
    `SELECT id FROM ${cam} WHERE id = ? AND unit = ? LIMIT 1`,
    [caId, sessionUnitId]
  );
  if (!rows?.length) {
    throwAccountsExpenseVoucherValidation(
      "NPA Current AC must belong to your unit’s current account list."
    );
  }
}

async function resolveYearCodeByDate(conn, bizDate) {
  const ymd = toYyyyMmDdForSqlDateField(bizDate);
  if (!ymd) {
    throwAccountsExpenseVoucherValidation("Date is required to generate Voucher No.");
  }
  const fyTable = escapeSqlTableIdForModuleConfig(modules.financial_year_master);
  const [rows] = await conn.query(
    `SELECT yearCode FROM ${fyTable} WHERE ? BETWEEN startDate AND endDate LIMIT 1`,
    [ymd]
  );
  const yearCode = String(rowValueForField(rows?.[0] || {}, "yearCode") ?? "").trim();
  if (!yearCode) {
    throwAccountsExpenseVoucherValidation("No Financial Year found for selected Date.");
  }
  return yearCode;
}

/**
 * Stamp voucherNo as EXP/&lt;yearCode&gt;/&lt;4-digit serial&gt; using module_number_sequence.
 */
export async function assignAccountsExpenseVoucherVoucherNo(conn, recordId) {
  // --- Voucher EXP/<yearCode>/#### stamped after INSERT ---
  const mod = modules.accounts_expense_voucher;
  if (!mod?.table) {
    throwAccountsExpenseVoucherValidation("accounts_expense_voucher module config missing.");
  }
  const tbl = escapeSqlTableIdForModuleConfig(mod);
  const seqTable = escapeSqlTableId("module_number_sequence");

  const [rows] = await conn.query(`SELECT id, date FROM ${tbl} WHERE id = ? LIMIT 1`, [recordId]);
  if (!rows?.length) {
    throwAccountsExpenseVoucherValidation(
      "Expense Voucher row was not found while generating Voucher No."
    );
  }

  const yearCode = await resolveYearCodeByDate(conn, rowValueForField(rows[0], "date"));
  const sequencePrefix = `EXP/${yearCode}`;

  await conn.query(
    `INSERT INTO ${seqTable} (module, prefix, lastNumber) VALUES (?, ?, 0)
     ON DUPLICATE KEY UPDATE lastNumber = lastNumber`,
    [ACCOUNTS_EXPENSE_VOUCHER_MODULE_KEY, sequencePrefix]
  );

  const [seqRows] = await conn.query(`SELECT lastNumber FROM ${seqTable} WHERE module = ? AND prefix = ? FOR UPDATE`, [
    ACCOUNTS_EXPENSE_VOUCHER_MODULE_KEY,
    sequencePrefix
  ]);
  if (!seqRows?.length) {
    throwAccountsExpenseVoucherValidation("Expense Voucher sequence row missing.");
  }

  const last = Number(rowValueForField(seqRows[0], "lastNumber"));
  const next = Number.isFinite(last) ? last + 1 : 1;
  const voucherNo = `EXP/${yearCode}/${String(next).padStart(4, "0")}`;

  await conn.query(`UPDATE ${seqTable} SET lastNumber = ? WHERE module = ? AND prefix = ?`, [
    next,
    ACCOUNTS_EXPENSE_VOUCHER_MODULE_KEY,
    sequencePrefix
  ]);
  await conn.query(`UPDATE ${tbl} SET voucherNo = ? WHERE id = ? AND (voucherNo IS NULL OR TRIM(voucherNo) = '')`, [
    voucherNo,
    recordId
  ]);
}

/**
 * Run all Expense Voucher validations before create/update.
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {{ parentData: object, user: object }} ctx
 */
export async function validateAccountsExpenseVoucherBeforeWrite(conn, { parentData, user }) {
  // --- FY freeze, payment mode, NPA/cheque, unit-operator scope ---
  await assertAccountsExpenseVoucherDateNotInFrozenFy(conn, parentData, user);
  assertAccountsExpenseVoucherPaymentMode(parentData);
  assertAccountsExpenseVoucherNpaCurrentAcRule(parentData);
  assertAccountsExpenseVoucherChequeFields(parentData);
  await assertAccountsExpenseVoucherRole2UnitAndCurrentAc(conn, parentData, user);
}

/**
 * CRUD beforeWrite: clear NPA on Cash when omitted, then validate.
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {{ oldRow?: object | null, merged: object, user: object, recordId?: number | null }} ctx
 */
export async function applyAccountsExpenseVoucherBeforeWrite(conn, { oldRow, merged, user, recordId = null }) {
  // Cash mode clears NPA in memory and on the row when the client omits the field.
  const explicitNpa = merged != null && Object.prototype.hasOwnProperty.call(merged, "npaCurrentAc");
  const effectiveBase = oldRow ? { ...oldRow, ...merged } : merged;
  const pm = normalizePaymentMode(effectiveBase?.paymentMode);

  let parentData = effectiveBase;
  if (pm === "cash" && !explicitNpa) {
    parentData = { ...effectiveBase, npaCurrentAc: null };
  }

  await validateAccountsExpenseVoucherBeforeWrite(conn, { parentData, user });

  if (recordId != null && Number.isFinite(recordId) && recordId > 0 && pm === "cash" && !explicitNpa) {
    const modCfg = modules.accounts_expense_voucher;
    const mt = escapeSqlTableIdForModuleConfig(modCfg);
    await conn.query(`UPDATE ${mt} SET npaCurrentAc = NULL WHERE id = ?`, [recordId]);
  }
}


