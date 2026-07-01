/**
 * Suspense Entry — voucher stamp for `accounts_suspense_entry` after INSERT.
 * Plain-language overview: @see docs/README-accounts-modules.md
 */
// Module-specific file: Suspense Entry — voucher stamp only (no CRUD-phase validations).

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
export const ACCOUNTS_SUSPENSE_ENTRY_MODULE_KEY = "accounts_suspense_entry";

/**
 * Align with `accounts_suspense_entry.postCreateAck` in config/modules.js.
 */
export const ACCOUNTS_SUSPENSE_ENTRY_POST_CREATE_ACK_CONFIG = {
  field: "voucherNo",
  title: "Suspense entry saved",
  hint: "Your voucher number is shown below. Continue to enter another record.",
  valueLabel: "Voucher No",
  showPrintPdf: false,
  showCopyButton: false
};

function throwAccountsSuspenseStampError(message) {
  throw Object.assign(new Error(message), { code: "ACCOUNTS_SUSPENSE_ENTRY_VALIDATION_FAILED" });
}

async function assertAccountsSuspenseEntryDateNotInFrozenFy(conn, parentData, user) {
  // Only unit operators are blocked by FY freeze; admins may still post suspense items.
  if (!shouldEnforceFreezeTransactionsForUser(user)) return;
  await assertDateNotInFrozenFinancialYear(conn, parentData?.date, {
    onBlocked: () => throwAccountsSuspenseStampError(FREEZE_TRANSACTIONS_LOCKED_MESSAGE)
  });
}

export async function validateAccountsSuspenseEntryBeforeWrite(conn, { parentData, user }) {
  // Suspense entries only enforce FY freeze (no payment-mode rules on this screen).
  await assertAccountsSuspenseEntryDateNotInFrozenFy(conn, parentData, user);
}

export async function applyAccountsSuspenseEntryBeforeWrite(conn, { oldRow, merged, user }) {
  const parentData = oldRow ? { ...oldRow, ...merged } : merged;
  await validateAccountsSuspenseEntryBeforeWrite(conn, { parentData, user });
}

async function resolveYearCodeByDate(conn, bizDate) {
  const ymd = toYyyyMmDdForSqlDateField(bizDate);
  if (!ymd) {
    throwAccountsSuspenseStampError("Date is required to generate Voucher No.");
  }
  const fyTable = escapeSqlTableIdForModuleConfig(modules.financial_year_master);
  const [rows] = await conn.query(
    `SELECT yearCode FROM ${fyTable} WHERE ? BETWEEN startDate AND endDate LIMIT 1`,
    [ymd]
  );
  const yearCode = String(rowValueForField(rows?.[0] || {}, "yearCode") ?? "").trim();
  if (!yearCode) {
    throwAccountsSuspenseStampError("No Financial Year found for selected Date.");
  }
  return yearCode;
}

/**
 * Stamp voucherNo as SUSP/&lt;yearCode&gt;/&lt;4-digit serial&gt; using module_number_sequence.
 */
export async function assignAccountsSuspenseEntryVoucherNo(conn, recordId) {
  // --- Voucher SUSP/<yearCode>/#### after INSERT ---
  const mod = modules.accounts_suspense_entry;
  if (!mod?.table) {
    throwAccountsSuspenseStampError("accounts_suspense_entry module config missing.");
  }
  const tbl = escapeSqlTableIdForModuleConfig(mod);
  const seqTable = escapeSqlTableId("module_number_sequence");

  const [rows] = await conn.query(`SELECT id, date FROM ${tbl} WHERE id = ? LIMIT 1`, [recordId]);
  if (!rows?.length) {
    throwAccountsSuspenseStampError("Suspense Entry row was not found while generating Voucher No.");
  }

  const yearCode = await resolveYearCodeByDate(conn, rowValueForField(rows[0], "date"));
  const sequencePrefix = `SUSP/${yearCode}`;

  await conn.query(
    `INSERT INTO ${seqTable} (module, prefix, lastNumber) VALUES (?, ?, 0)
     ON DUPLICATE KEY UPDATE lastNumber = lastNumber`,
    [ACCOUNTS_SUSPENSE_ENTRY_MODULE_KEY, sequencePrefix]
  );

  const [seqRows] = await conn.query(`SELECT lastNumber FROM ${seqTable} WHERE module = ? AND prefix = ? FOR UPDATE`, [
    ACCOUNTS_SUSPENSE_ENTRY_MODULE_KEY,
    sequencePrefix
  ]);
  if (!seqRows?.length) {
    throwAccountsSuspenseStampError("Suspense Entry sequence row missing.");
  }

  const last = Number(rowValueForField(seqRows[0], "lastNumber"));
  const next = Number.isFinite(last) ? last + 1 : 1;
  const voucherNo = `SUSP/${yearCode}/${String(next).padStart(4, "0")}`;

  await conn.query(`UPDATE ${seqTable} SET lastNumber = ? WHERE module = ? AND prefix = ?`, [
    next,
    ACCOUNTS_SUSPENSE_ENTRY_MODULE_KEY,
    sequencePrefix
  ]);
  await conn.query(`UPDATE ${tbl} SET voucherNo = ? WHERE id = ? AND (voucherNo IS NULL OR TRIM(voucherNo) = '')`, [
    voucherNo,
    recordId
  ]);
}
