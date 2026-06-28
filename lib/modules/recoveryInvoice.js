/**
 * Recovery Invoice — server-only rules (invoice number stamp, grand total from line items).
 * Client behaviour lives in `recoveryInvoiceClient.js`.
 */

import { modules } from "../../config/modules";
import { INVOICE_NUMBER_SEQUENCE_MODULE } from "./invoiceNumberSequence";
import { rowValueForField } from "../gridRowValue";
import { escapeSqlTableId, escapeSqlTableIdForModuleConfig } from "../sqlModuleTable";
import { toYyyyMmDdForSqlDateField } from "../sqlDateFieldValue";
import {
  assertCaseEligibleForNewInvoice,
  normalizeFinalInvoiceFlag,
  syncNciFinalInvoiceAfterInvoiceWrite
} from "./invoiceFinalInvoice";
import {
  assertDateNotInFrozenFinancialYear,
  FREEZE_TRANSACTIONS_LOCKED_MESSAGE,
  shouldEnforceFreezeTransactionsForUser
} from "./freezeTransactionsLock";

export const RECOVERY_INVOICE_MODULE_KEY = "recovery_invoice";

export {
  INVOICE_UNIT_2_ID as RECOVERY_INVOICE_UNIT_2_ID,
  INVOICE_NPA_UNIT_2_ID as RECOVERY_INVOICE_NPA_UNIT_2_ID,
  INVOICE_NPA_DEFAULT_ID as RECOVERY_INVOICE_NPA_DEFAULT_ID,
  resolveInvoiceNpaCurrentAcByCaseId as resolveRecoveryInvoiceNpaCurrentAcByCaseId
} from "./invoiceNpaCurrentAc";

function throwRecoveryInvoiceValidation(message) {
  throw Object.assign(new Error(message), { code: "RECOVERY_INVOICE_VALIDATION_FAILED" });
}

async function assertRecoveryInvoiceDateNotInFrozenFy(conn, parentData, user) {
  if (!shouldEnforceFreezeTransactionsForUser(user)) return;
  await assertDateNotInFrozenFinancialYear(conn, parentData?.date, {
    onBlocked: () => throwRecoveryInvoiceValidation(FREEZE_TRANSACTIONS_LOCKED_MESSAGE)
  });
}

/**
 * Sum `amount` from submitted child rows for key `recovery_charges` (matches config/modules.js).
 * @param {Record<string, unknown[]> | null | undefined} childTableRows
 * @returns {number}
 */
export const RECOVERY_INVOICE_CHARGES_CHILD_KEY = "recovery_charges";

export function sumRecoveryInvoiceChargesAmount(childTableRows) {
  const rows = Array.isArray(childTableRows?.[RECOVERY_INVOICE_CHARGES_CHILD_KEY])
    ? childTableRows[RECOVERY_INVOICE_CHARGES_CHILD_KEY]
    : [];
  let sum = 0;
  for (const row of rows) {
    const n = Number(rowValueForField(row || {}, "amount"));
    if (Number.isFinite(n)) sum += n;
  }
  return Math.round(sum * 100) / 100;
}

async function resolveYearCodeByDate(conn, bizDate) {
  const ymd = toYyyyMmDdForSqlDateField(bizDate);
  if (!ymd) {
    throwRecoveryInvoiceValidation("Date is required to generate Invoice No.");
  }
  const fyTable = escapeSqlTableIdForModuleConfig(modules.financial_year_master);
  const [rows] = await conn.query(
    `SELECT yearCode FROM ${fyTable} WHERE ? BETWEEN startDate AND endDate LIMIT 1`,
    [ymd]
  );
  const yearCode = String(rowValueForField(rows?.[0] || {}, "yearCode") ?? "").trim();
  if (!yearCode) {
    throwRecoveryInvoiceValidation("No Financial Year found for selected Date.");
  }
  return yearCode;
}

/**
 * Stamp `invoiceNo` as INV/&lt;yearCode&gt;/&lt;4-digit serial&gt; (shared `module_number_sequence` key `invoice` with SARFAESI & vehicle).
 */
export async function assignRecoveryInvoiceInvoiceNo(conn, recordId) {
  // --- Invoice INV/<yearCode>/#### (shared serial with SARFAESI & vehicle invoices) ---
  const mod = modules.recovery_invoice;
  if (!mod?.table) {
    throwRecoveryInvoiceValidation("recovery_invoice module config missing.");
  }
  const tbl = escapeSqlTableIdForModuleConfig(mod);
  const seqTable = escapeSqlTableId("module_number_sequence");

  const [rows] = await conn.query(`SELECT id, date FROM ${tbl} WHERE id = ? LIMIT 1`, [recordId]);
  if (!rows?.length) {
    throwRecoveryInvoiceValidation("Recovery Invoice row was not found while generating Invoice No.");
  }

  const yearCode = await resolveYearCodeByDate(conn, rowValueForField(rows[0], "date"));
  const sequencePrefix = `INV/${yearCode}`;

  await conn.query(
    `INSERT INTO ${seqTable} (module, prefix, lastNumber) VALUES (?, ?, 0)
     ON DUPLICATE KEY UPDATE lastNumber = lastNumber`,
    [INVOICE_NUMBER_SEQUENCE_MODULE, sequencePrefix]
  );

  const [seqRows] = await conn.query(`SELECT lastNumber FROM ${seqTable} WHERE module = ? AND prefix = ? FOR UPDATE`, [
    INVOICE_NUMBER_SEQUENCE_MODULE,
    sequencePrefix
  ]);
  if (!seqRows?.length) {
    throwRecoveryInvoiceValidation("Recovery Invoice sequence row missing.");
  }

  const last = Number(rowValueForField(seqRows[0], "lastNumber"));
  const next = Number.isFinite(last) ? last + 1 : 1;
  const invoiceNo = `INV/${yearCode}/${String(next).padStart(4, "0")}`;

  await conn.query(`UPDATE ${seqTable} SET lastNumber = ? WHERE module = ? AND prefix = ?`, [
    next,
    INVOICE_NUMBER_SEQUENCE_MODULE,
    sequencePrefix
  ]);
  await conn.query(`UPDATE ${tbl} SET invoiceNo = ? WHERE id = ? AND (invoiceNo IS NULL OR TRIM(invoiceNo) = '')`, [
    invoiceNo,
    recordId
  ]);
}

/**
 * Recompute `merged.grandTotal` from child charges (authoritative on save).
 */
export async function applyRecoveryInvoiceBeforeWrite(conn, { oldRow, merged, childTableRows, user }) {
  // FY freeze, case not already final, normalize final flag, grand total from charge lines.
  const parentData = oldRow ? { ...oldRow, ...merged } : merged;
  await assertRecoveryInvoiceDateNotInFrozenFy(conn, parentData, user);
  await assertCaseEligibleForNewInvoice(conn, merged?.caseNo, !oldRow);
  if (merged && "finalInvoice" in merged) {
    merged.finalInvoice = normalizeFinalInvoiceFlag(merged.finalInvoice);
  }
  const total = sumRecoveryInvoiceChargesAmount(childTableRows);
  merged.grandTotal = total;
}

/** After create/update — recompute `new_case_inward.finalInvoice` from all invoice modules. */
export async function afterRecoveryInvoiceWrite(conn, ctx) {
  await syncNciFinalInvoiceAfterInvoiceWrite(conn, RECOVERY_INVOICE_MODULE_KEY, ctx);
}
