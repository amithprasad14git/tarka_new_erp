/**
 * Loan Account — server rules and voucher stamping for `accounts_loan_ac`.
 * Plain-language overview: @see docs/README-accounts-modules.md
 */
// Module-specific file: Loan Account business rules (mirror accounts_expense_voucher patterns).

import { modules } from "../../config/modules";
import { rowValueForField } from "../gridRowValue";
import { escapeSqlTableId, escapeSqlTableIdForModuleConfig } from "../sqlModuleTable";
import { toYyyyMmDdForSqlDateField } from "../sqlDateFieldValue";
import {
  assertDateNotInFrozenFinancialYear,
  FREEZE_TRANSACTIONS_LOCKED_MESSAGE,
  shouldEnforceFreezeTransactionsForUser
} from "./freezeTransactionsLock";

export const ACCOUNTS_LOAN_AC_MODULE_KEY = "accounts_loan_ac";

export const ACCOUNTS_LOAN_AC_UNIT_RESTRICT_ROLE = 2;

/**
 * Align with `accounts_loan_ac.postCreateAck` in config/modules.js.
 */
export const ACCOUNTS_LOAN_AC_POST_CREATE_ACK_CONFIG = {
  field: "voucherNo",
  title: "Loan entry saved",
  hint: "Your voucher number is shown below. Continue to enter another record.",
  showPrintPdf: false,
  showCopyButton: false
};

function throwAccountsLoanAcValidation(message) {
  throw Object.assign(new Error(message), { code: "ACCOUNTS_LOAN_AC_VALIDATION_FAILED" });
}

async function assertAccountsLoanAcDateNotInFrozenFy(conn, parentData, user) {
  // Block unit operators when the loan entry date is in a frozen FY.
  if (!shouldEnforceFreezeTransactionsForUser(user)) return;
  await assertDateNotInFrozenFinancialYear(conn, parentData?.date, {
    onBlocked: () => throwAccountsLoanAcValidation(FREEZE_TRANSACTIONS_LOCKED_MESSAGE)
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

/** @returns {'Receipt' | 'Payment' | null} */
function normalizeTransactionType(value) {
  const s = String(value ?? "").trim();
  if (s === "Receipt" || s === "Payment") return s;
  return null;
}

export function assertAccountsLoanAcTransactionType(parentData) {
  if (!normalizeTransactionType(parentData?.transactionType)) {
    throwAccountsLoanAcValidation("Transaction Type must be Receipt or Payment.");
  }
}

const ALLOWED_LOAN_AC_PAYMENT_MODES = new Set(["card", "cheque", "cash", "upi"]);

export function assertAccountsLoanAcPaymentMode(parentData) {
  const pm = normalizePaymentMode(parentData?.paymentMode);
  if (!pm) {
    throwAccountsLoanAcValidation("Payment Mode is required.");
  }
  if (!ALLOWED_LOAN_AC_PAYMENT_MODES.has(pm)) {
    throwAccountsLoanAcValidation("Payment Mode is invalid.");
  }
}

/**
 * Cash: NPA Current AC must be empty. Other modes: NPA Current AC is required.
 */
export function assertAccountsLoanAcNpaCurrentAcRule(parentData) {
  const pm = normalizePaymentMode(parentData?.paymentMode);
  const caId = asPositiveInt(parentData?.npaCurrentAc);

  // Cash loan entries do not tie to an NPA current account; other modes must.
  if (pm === "cash") {
    if (caId != null) {
      throwAccountsLoanAcValidation(
        "NPA Current AC must be empty when Payment Mode is Cash."
      );
    }
    return;
  }

  if (!caId) {
    throwAccountsLoanAcValidation(
      "NPA Current AC is required unless Payment Mode is Cash."
    );
  }
}

export function assertAccountsLoanAcChequeFields(parentData) {
  const pm = normalizePaymentMode(parentData?.paymentMode);
  if (pm !== "cheque") return;

  const chequeNo = String(parentData?.chequeNo ?? "").trim();
  if (!chequeNo) {
    throwAccountsLoanAcValidation("Cheque No is required when Payment Mode is Cheque.");
  }
  const chequeDateYmd = toYyyyMmDdForSqlDateField(parentData?.chequeDate);
  if (!chequeDateYmd) {
    throwAccountsLoanAcValidation("Cheque Date is required when Payment Mode is Cheque.");
  }
}

export async function assertAccountsLoanAcRole2UnitAndCurrentAc(conn, parentData, user) {
  // Unit operators may only use their branch and its current accounts.
  const role = Number(user?.role);
  if (!Number.isFinite(role) || role !== ACCOUNTS_LOAN_AC_UNIT_RESTRICT_ROLE) return;

  const sessionUnitId = asPositiveInt(user?.unit);
  if (sessionUnitId == null) return;

  const rowUnitId = asPositiveInt(parentData?.unit);
  if (rowUnitId !== sessionUnitId) {
    throwAccountsLoanAcValidation("Unit must match your assigned unit.");
  }

  const caId = asPositiveInt(parentData?.npaCurrentAc);
  if (!caId) return;

  const cam = escapeSqlTableIdForModuleConfig(modules.current_account_master);
  const [rows] = await conn.query(
    `SELECT id FROM ${cam} WHERE id = ? AND unit = ? LIMIT 1`,
    [caId, sessionUnitId]
  );
  if (!rows?.length) {
    throwAccountsLoanAcValidation(
      "NPA Current AC must belong to your unit’s current account list."
    );
  }
}

async function resolveYearCodeByDate(conn, bizDate) {
  const ymd = toYyyyMmDdForSqlDateField(bizDate);
  if (!ymd) {
    throwAccountsLoanAcValidation("Date is required to generate Voucher No.");
  }
  const fyTable = escapeSqlTableIdForModuleConfig(modules.financial_year_master);
  const [rows] = await conn.query(
    `SELECT yearCode FROM ${fyTable} WHERE ? BETWEEN startDate AND endDate LIMIT 1`,
    [ymd]
  );
  const yearCode = String(rowValueForField(rows?.[0] || {}, "yearCode") ?? "").trim();
  if (!yearCode) {
    throwAccountsLoanAcValidation("No Financial Year found for selected Date.");
  }
  return yearCode;
}

/**
 * Voucher by transaction type (separate running serial per FY per type):
 * - Receipt → LN/CR/&lt;yearCode&gt;/&lt;4-digit serial&gt;
 * - Payment → LN/DR/&lt;yearCode&gt;/&lt;4-digit serial&gt;
 * Sequence key: `prefix = ${lead}/${yearCode}` in module_number_sequence.
 */
export async function assignAccountsLoanAcVoucherNo(conn, recordId) {
  // --- Voucher LN/CR (receipt) or LN/DR (payment) per FY, assigned after INSERT ---
  const mod = modules.accounts_loan_ac;
  if (!mod?.table) {
    throwAccountsLoanAcValidation("accounts_loan_ac module config missing.");
  }
  const tbl = escapeSqlTableIdForModuleConfig(mod);
  const seqTable = escapeSqlTableId("module_number_sequence");

  const [rows] = await conn.query(`SELECT id, date, transactionType FROM ${tbl} WHERE id = ? LIMIT 1`, [recordId]);
  if (!rows?.length) {
    throwAccountsLoanAcValidation(
      "Loan Account row was not found while generating Voucher No."
    );
  }

  const txType = normalizeTransactionType(rowValueForField(rows[0], "transactionType"));
  if (!txType) {
    throwAccountsLoanAcValidation("Transaction Type is required to generate Voucher No.");
  }

  const yearCode = await resolveYearCodeByDate(conn, rowValueForField(rows[0], "date"));
  // Receipt and payment each have their own running number within the same financial year.
  const lead = txType === "Payment" ? "LN/DR" : "LN/CR";
  const sequencePrefix = `${lead}/${yearCode}`;

  await conn.query(
    `INSERT INTO ${seqTable} (module, prefix, lastNumber) VALUES (?, ?, 0)
     ON DUPLICATE KEY UPDATE lastNumber = lastNumber`,
    [ACCOUNTS_LOAN_AC_MODULE_KEY, sequencePrefix]
  );

  const [seqRows] = await conn.query(`SELECT lastNumber FROM ${seqTable} WHERE module = ? AND prefix = ? FOR UPDATE`, [
    ACCOUNTS_LOAN_AC_MODULE_KEY,
    sequencePrefix
  ]);
  if (!seqRows?.length) {
    throwAccountsLoanAcValidation("Loan Account sequence row missing.");
  }

  const last = Number(rowValueForField(seqRows[0], "lastNumber"));
  const next = Number.isFinite(last) ? last + 1 : 1;
  const voucherNo = `${lead}/${yearCode}/${String(next).padStart(4, "0")}`;

  await conn.query(`UPDATE ${seqTable} SET lastNumber = ? WHERE module = ? AND prefix = ?`, [
    next,
    ACCOUNTS_LOAN_AC_MODULE_KEY,
    sequencePrefix
  ]);
  await conn.query(`UPDATE ${tbl} SET voucherNo = ? WHERE id = ? AND (voucherNo IS NULL OR TRIM(voucherNo) = '')`, [
    voucherNo,
    recordId
  ]);
}

export async function validateAccountsLoanAcBeforeWrite(conn, { parentData, user }) {
  // --- FY freeze, receipt/payment type, payment mode, NPA/cheque, unit-operator checks ---
  await assertAccountsLoanAcDateNotInFrozenFy(conn, parentData, user);
  assertAccountsLoanAcTransactionType(parentData);
  assertAccountsLoanAcPaymentMode(parentData);
  assertAccountsLoanAcNpaCurrentAcRule(parentData);
  assertAccountsLoanAcChequeFields(parentData);
  await assertAccountsLoanAcRole2UnitAndCurrentAc(conn, parentData, user);
}

export async function applyAccountsLoanAcBeforeWrite(conn, { oldRow, merged, user, recordId = null }) {
  // When switching to Cash, clear stored NPA if the form did not send npaCurrentAc (partial update).
  const explicitNpa = merged != null && Object.prototype.hasOwnProperty.call(merged, "npaCurrentAc");
  const effectiveBase = oldRow ? { ...oldRow, ...merged } : merged;
  const pm = normalizePaymentMode(effectiveBase?.paymentMode);

  let parentData = effectiveBase;
  if (pm === "cash" && !explicitNpa) {
    parentData = { ...effectiveBase, npaCurrentAc: null };
  }

  await validateAccountsLoanAcBeforeWrite(conn, { parentData, user });

  if (recordId != null && Number.isFinite(recordId) && recordId > 0 && pm === "cash" && !explicitNpa) {
    const modCfg = modules.accounts_loan_ac;
    const mt = escapeSqlTableIdForModuleConfig(modCfg);
    await conn.query(`UPDATE ${mt} SET npaCurrentAc = NULL WHERE id = ?`, [recordId]);
  }
}
