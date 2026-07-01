/**
 * SARFAESI Invoice — server-only rules (invoice number stamp, grand total from line items).
 * Client behaviour lives in `sarfaesiInvoiceClient.js`.
 *
 * Registered in crudModuleAdapters, moduleAfterCreate, crud.service (validation code),
 * MasterModuleClient + sarfaesiInvoiceClient (UI), and `sarfaesi_invoice_case_picker` on new_case_inward LoV.
 */

import { modules } from "../../config/modules";
import { INVOICE_NUMBER_SEQUENCE_MODULE } from "./invoiceNumberSequence";
import { rowValueForField } from "../gridRowValue";
import { escapeSqlTableId, escapeSqlTableIdForModuleConfig } from "../sqlModuleTable";
import { toYyyyMmDdForSqlDateField } from "../sqlDateFieldValue";
import {
  assertCaseEligibleForNewInvoice,
  isInvoiceFinalInvoiceUnlockUpdate,
  normalizeFinalInvoiceFlag,
  syncNciFinalInvoiceAfterInvoiceWrite
} from "./invoiceFinalInvoice";
import {
  assertDateNotInFrozenFinancialYear,
  FREEZE_TRANSACTIONS_LOCKED_MESSAGE,
  shouldEnforceFreezeTransactionsForUser
} from "./freezeTransactionsLock";

export const SARFAESI_INVOICE_MODULE_KEY = "sarfaesi_invoice";

/** Matches `childTables[].key` in config/modules.js for this module. */
export const SARFAESI_INVOICE_CHARGES_CHILD_KEY = "sarfaesi_charges";

/** GET `/api/crud/new_case_inward?lov=1&…` — Case No picker for this module only. */
export const SARFAESI_INVOICE_CASE_PICKER_LOV_PARAM = "sarfaesi_invoice_case_picker";

/** `lookup_type_master.lookupType` / `lookup_value_master.lookupValue` for eligible NCI rows. */
export const SARFAESI_INVOICE_LOAN_CATEGORY_LOOKUP_TYPE = "Loan Category";
export const SARFAESI_INVOICE_LOAN_CATEGORY_LOOKUP_VALUE = "SARFAESI";

/**
 * SARFAESI Invoice Case No picker: only `new_case_inward` rows whose Loan Category is SARFAESI.
 * Called from `app/api/crud/[module]/route.js` when `sarfaesi_invoice_case_picker=1`.
 *
 * @param {{
 *   mysql: { escapeId: (name: string) => string },
 *   mainTableRef: string,
 *   whereParts: string[],
 *   whereValues: unknown[],
 * }} args
 */
export function appendSarfaesiInvoiceCasePickerLoanCategoryFilter({
  mysql,
  mainTableRef,
  whereParts,
  whereValues
}) {
  if (!mysql || !mainTableRef || !whereParts || !whereValues) return;

  const lvm = escapeSqlTableIdForModuleConfig(modules.lookup_value_master);
  const ltm = escapeSqlTableIdForModuleConfig(modules.lookup_type_master);
  const loanCategoryCol = `${mainTableRef}.${mysql.escapeId("loanCategory")}`;
  const lvmId = mysql.escapeId("id");
  const lvmLookupType = mysql.escapeId("lookupType");
  const lvmLookupValue = mysql.escapeId("lookupValue");
  const ltmId = mysql.escapeId("id");
  const ltmLookupType = mysql.escapeId("lookupType");

  whereParts.push(
    `${loanCategoryCol} IN (
      SELECT lvm.${lvmId}
      FROM ${lvm} lvm
      INNER JOIN ${ltm} ltm ON lvm.${lvmLookupType} = ltm.${ltmId}
      WHERE LOWER(TRIM(ltm.${ltmLookupType})) = LOWER(TRIM(?))
        AND LOWER(TRIM(lvm.${lvmLookupValue})) = LOWER(TRIM(?))
    )`
  );
  whereValues.push(SARFAESI_INVOICE_LOAN_CATEGORY_LOOKUP_TYPE, SARFAESI_INVOICE_LOAN_CATEGORY_LOOKUP_VALUE);
}

async function assertSarfaesiInvoiceCaseIsSarfaesiLoan(conn, caseIdRaw) {
  const caseId = Number(caseIdRaw);
  if (!Number.isFinite(caseId) || caseId <= 0) {
    throwSarfaesiInvoiceValidation("Case No is required.");
  }
  const nci = escapeSqlTableIdForModuleConfig(modules.new_case_inward);
  const lvm = escapeSqlTableIdForModuleConfig(modules.lookup_value_master);
  const ltm = escapeSqlTableIdForModuleConfig(modules.lookup_type_master);
  const [rows] = await conn.query(
    `SELECT nci.id
     FROM ${nci} nci
     WHERE nci.id = ?
       AND nci.loanCategory IN (
         SELECT lvm.id
         FROM ${lvm} lvm
         INNER JOIN ${ltm} ltm ON lvm.lookupType = ltm.id
         WHERE LOWER(TRIM(ltm.lookupType)) = LOWER(TRIM(?))
           AND LOWER(TRIM(lvm.lookupValue)) = LOWER(TRIM(?))
       )
     LIMIT 1`,
    [caseId, SARFAESI_INVOICE_LOAN_CATEGORY_LOOKUP_TYPE, SARFAESI_INVOICE_LOAN_CATEGORY_LOOKUP_VALUE]
  );
  if (!rows?.length) {
    throwSarfaesiInvoiceValidation("Case No must be a SARFAESI loan category case.");
  }
}

function throwSarfaesiInvoiceValidation(message) {
  throw Object.assign(new Error(message), { code: "SARFAESI_INVOICE_VALIDATION_FAILED" });
}

async function assertSarfaesiInvoiceDateNotInFrozenFy(conn, parentData, user) {
  if (!shouldEnforceFreezeTransactionsForUser(user)) return;
  await assertDateNotInFrozenFinancialYear(conn, parentData?.date, {
    onBlocked: () => throwSarfaesiInvoiceValidation(FREEZE_TRANSACTIONS_LOCKED_MESSAGE)
  });
}

/**
 * Sum `amount` from submitted child rows for key `sarfaesi_charges`.
 * @param {Record<string, unknown[]> | null | undefined} childTableRows
 * @returns {number}
 */
export function sumSarfaesiInvoiceChargesAmount(childTableRows) {
  const rows = Array.isArray(childTableRows?.[SARFAESI_INVOICE_CHARGES_CHILD_KEY])
    ? childTableRows[SARFAESI_INVOICE_CHARGES_CHILD_KEY]
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
    throwSarfaesiInvoiceValidation("Date is required to generate Invoice No.");
  }
  const fyTable = escapeSqlTableIdForModuleConfig(modules.financial_year_master);
  const [rows] = await conn.query(
    `SELECT yearCode FROM ${fyTable} WHERE ? BETWEEN startDate AND endDate LIMIT 1`,
    [ymd]
  );
  const yearCode = String(rowValueForField(rows?.[0] || {}, "yearCode") ?? "").trim();
  if (!yearCode) {
    throwSarfaesiInvoiceValidation("No Financial Year found for selected Date.");
  }
  return yearCode;
}

/**
 * Stamp `invoiceNo` as INV/&lt;yearCode&gt;/&lt;4-digit serial&gt; (shared `module_number_sequence` key `invoice` with recovery & vehicle).
 */
export async function assignSarfaesiInvoiceInvoiceNo(conn, recordId) {
  // --- Same INV/<yearCode>/#### sequence as recovery & vehicle (module key `invoice`) ---
  const mod = modules.sarfaesi_invoice;
  if (!mod?.table) {
    throwSarfaesiInvoiceValidation("sarfaesi_invoice module config missing.");
  }
  const tbl = escapeSqlTableIdForModuleConfig(mod);
  const seqTable = escapeSqlTableId("module_number_sequence");

  const [rows] = await conn.query(`SELECT id, date FROM ${tbl} WHERE id = ? LIMIT 1`, [recordId]);
  if (!rows?.length) {
    throwSarfaesiInvoiceValidation("SARFAESI Invoice row was not found while generating Invoice No.");
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
    throwSarfaesiInvoiceValidation("SARFAESI Invoice sequence row missing.");
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
 * Recompute `merged.grandTotal` from child charge lines (authoritative on save).
 */
export async function applySarfaesiInvoiceBeforeWrite(conn, { oldRow, merged, childTableRows, user }) {
  // Case must be SARFAESI loan category; totals and final-invoice flag applied on save.
  const parentData = oldRow ? { ...oldRow, ...merged } : merged;
  const childTotal = sumSarfaesiInvoiceChargesAmount(childTableRows);
  const unlockOnly =
    oldRow && isInvoiceFinalInvoiceUnlockUpdate(oldRow, merged, { childTotal });
  if (!unlockOnly) {
    await assertSarfaesiInvoiceDateNotInFrozenFy(conn, parentData, user);
  }
  await assertCaseEligibleForNewInvoice(conn, merged?.caseNo, !oldRow);
  await assertSarfaesiInvoiceCaseIsSarfaesiLoan(conn, merged?.caseNo);
  if (merged && "finalInvoice" in merged) {
    merged.finalInvoice = normalizeFinalInvoiceFlag(merged.finalInvoice);
  }
  merged.grandTotal = childTotal;
}

/** After create/update — recompute `new_case_inward.finalInvoice` from all invoice modules. */
export async function afterSarfaesiInvoiceWrite(conn, ctx) {
  await syncNciFinalInvoiceAfterInvoiceWrite(conn, SARFAESI_INVOICE_MODULE_KEY, ctx);
}
