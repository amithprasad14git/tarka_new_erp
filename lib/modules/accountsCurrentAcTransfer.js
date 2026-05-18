// Module-specific file: Current AC Transfer business rules.

import { modules } from "../../config/modules";
import { rowValueForField } from "../gridRowValue";
import { escapeSqlTableId, escapeSqlTableIdForModuleConfig } from "../sqlModuleTable";
import { toYyyyMmDdForSqlDateField } from "../sqlDateFieldValue";
import {
  assertDateNotInFrozenFinancialYear,
  FREEZE_TRANSACTIONS_LOCKED_MESSAGE,
  shouldEnforceFreezeTransactionsForUser
} from "./freezeTransactionsLock";

export const ACCOUNTS_CURRENT_AC_TRANSFER_MODULE_KEY = "accounts_current_ac_transfer";

function throwValidation(message) {
  throw Object.assign(new Error(message), { code: "ACCOUNTS_CURRENT_AC_TRANSFER_VALIDATION_FAILED" });
}

async function assertAccountsCurrentAcTransferDateNotInFrozenFy(conn, parentData, user) {
  if (!shouldEnforceFreezeTransactionsForUser(user)) return;
  await assertDateNotInFrozenFinancialYear(conn, parentData?.date, {
    onBlocked: () => throwValidation(FREEZE_TRANSACTIONS_LOCKED_MESSAGE)
  });
}

function asPositiveInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function assertAccountsCurrentAcTransferFromToDifferent(parentData) {
  const fromId = asPositiveInt(parentData?.fromCurrentAc);
  const toId = asPositiveInt(parentData?.toCurrentAc);
  if (!fromId || !toId) return;
  if (fromId === toId) {
    throwValidation("From Current AC and To Current AC must be different.");
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

/**
 * Voucher: ACC/TRF/&lt;yearCode&gt;/&lt;4-digit serial&gt; via module_number_sequence.
 */
export async function assignAccountsCurrentAcTransferVoucherNo(conn, recordId) {
  const mod = modules.accounts_current_ac_transfer;
  if (!mod?.table) {
    throwValidation("accounts_current_ac_transfer module config missing.");
  }
  const table = escapeSqlTableIdForModuleConfig(mod);
  const seqTable = escapeSqlTableId("module_number_sequence");

  const [rows] = await conn.query(`SELECT id, date FROM ${table} WHERE id = ? LIMIT 1`, [recordId]);
  if (!rows?.length) {
    throwValidation("Current AC Transfer row was not found while generating Voucher No.");
  }

  const yearCode = await resolveYearCodeByDate(conn, rowValueForField(rows[0], "date"));
  const sequencePrefix = `ACC/TRF/${yearCode}`;

  await conn.query(
    `INSERT INTO ${seqTable} (module, prefix, lastNumber) VALUES (?, ?, 0)
     ON DUPLICATE KEY UPDATE lastNumber = lastNumber`,
    [ACCOUNTS_CURRENT_AC_TRANSFER_MODULE_KEY, sequencePrefix]
  );

  const [seqRows] = await conn.query(`SELECT lastNumber FROM ${seqTable} WHERE module = ? AND prefix = ? FOR UPDATE`, [
    ACCOUNTS_CURRENT_AC_TRANSFER_MODULE_KEY,
    sequencePrefix
  ]);
  if (!seqRows?.length) {
    throwValidation("Current AC Transfer sequence row missing.");
  }

  const last = Number(rowValueForField(seqRows[0], "lastNumber"));
  const next = Number.isFinite(last) ? last + 1 : 1;
  const voucherNo = `ACC/TRF/${yearCode}/${String(next).padStart(4, "0")}`;

  await conn.query(`UPDATE ${seqTable} SET lastNumber = ? WHERE module = ? AND prefix = ?`, [
    next,
    ACCOUNTS_CURRENT_AC_TRANSFER_MODULE_KEY,
    sequencePrefix
  ]);
  await conn.query(`UPDATE ${table} SET voucherNo = ? WHERE id = ? AND (voucherNo IS NULL OR TRIM(voucherNo) = '')`, [
    voucherNo,
    recordId
  ]);
}

export async function validateAccountsCurrentAcTransferBeforeWrite(conn, { parentData, user }) {
  await assertAccountsCurrentAcTransferDateNotInFrozenFy(conn, parentData, user);
  assertAccountsCurrentAcTransferFromToDifferent(parentData);
}

export async function applyAccountsCurrentAcTransferBeforeWrite(conn, { oldRow, merged, user }) {
  const parentData = oldRow ? { ...oldRow, ...merged } : merged;
  await validateAccountsCurrentAcTransferBeforeWrite(conn, { parentData, user });
}
