/**
 * Vehicle Invoice — server-only rules (invoice number stamp, grand total from line items).
 * Client behaviour lives in `vehicleInvoiceClient.js`.
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

export const VEHICLE_INVOICE_MODULE_KEY = "vehicle_invoice";

/** Matches `childTables[].key` in config/modules.js for this module. */
export const VEHICLE_INVOICE_CHARGES_CHILD_KEY = "vehicle_charges";

/** GET `/api/crud/new_case_inward?lov=1&…` — Case No picker for this module only. */
export const VEHICLE_INVOICE_CASE_PICKER_LOV_PARAM = "vehicle_invoice_case_picker";

/** `lookup_type_master.lookupType` / `lookup_value_master.lookupValue` for eligible NCI rows. */
export const VEHICLE_INVOICE_LOAN_CATEGORY_LOOKUP_TYPE = "Loan Category";
export const VEHICLE_INVOICE_LOAN_CATEGORY_LOOKUP_VALUE = "Vehicle Loan";

/**
 * Vehicle Invoice Case No picker: only `new_case_inward` rows whose Loan Category is Vehicle Loan.
 * Called from `app/api/crud/[module]/route.js` when `vehicle_invoice_case_picker=1`.
 *
 * @param {{
 *   mysql: { escapeId: (name: string) => string },
 *   mainTableRef: string,
 *   whereParts: string[],
 *   whereValues: unknown[],
 * }} args
 */
export function appendVehicleInvoiceCasePickerLoanCategoryFilter({
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
  whereValues.push(VEHICLE_INVOICE_LOAN_CATEGORY_LOOKUP_TYPE, VEHICLE_INVOICE_LOAN_CATEGORY_LOOKUP_VALUE);
}

async function assertVehicleInvoiceCaseIsVehicleLoan(conn, caseIdRaw) {
  const caseId = Number(caseIdRaw);
  if (!Number.isFinite(caseId) || caseId <= 0) {
    throwVehicleInvoiceValidation("Case No is required.");
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
    [caseId, VEHICLE_INVOICE_LOAN_CATEGORY_LOOKUP_TYPE, VEHICLE_INVOICE_LOAN_CATEGORY_LOOKUP_VALUE]
  );
  if (!rows?.length) {
    throwVehicleInvoiceValidation("Case No must be a Vehicle Loan case.");
  }
}

function throwVehicleInvoiceValidation(message) {
  throw Object.assign(new Error(message), { code: "VEHICLE_INVOICE_VALIDATION_FAILED" });
}

async function assertVehicleInvoiceDateNotInFrozenFy(conn, parentData, user) {
  // Role 2 cannot invoice into a frozen FY; admins are not blocked here.
  if (!shouldEnforceFreezeTransactionsForUser(user)) return;
  await assertDateNotInFrozenFinancialYear(conn, parentData?.date, {
    onBlocked: () => throwVehicleInvoiceValidation(FREEZE_TRANSACTIONS_LOCKED_MESSAGE)
  });
}

/**
 * Sum `amount` from submitted child rows for key `vehicle_charges`.
 * @param {Record<string, unknown[]> | null | undefined} childTableRows
 * @returns {number}
 */
export function sumVehicleInvoiceChargesAmount(childTableRows) {
  const rows = Array.isArray(childTableRows?.[VEHICLE_INVOICE_CHARGES_CHILD_KEY])
    ? childTableRows[VEHICLE_INVOICE_CHARGES_CHILD_KEY]
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
    throwVehicleInvoiceValidation("Date is required to generate Invoice No.");
  }
  const fyTable = escapeSqlTableIdForModuleConfig(modules.financial_year_master);
  const [rows] = await conn.query(
    `SELECT yearCode FROM ${fyTable} WHERE ? BETWEEN startDate AND endDate LIMIT 1`,
    [ymd]
  );
  const yearCode = String(rowValueForField(rows?.[0] || {}, "yearCode") ?? "").trim();
  if (!yearCode) {
    throwVehicleInvoiceValidation("No Financial Year found for selected Date.");
  }
  return yearCode;
}

/**
 * Stamp `invoiceNo` as INV/&lt;yearCode&gt;/&lt;4-digit serial&gt; (shared `module_number_sequence` key `invoice` with recovery & SARFAESI).
 */
export async function assignVehicleInvoiceInvoiceNo(conn, recordId) {
  const mod = modules.vehicle_invoice;
  if (!mod?.table) {
    throwVehicleInvoiceValidation("vehicle_invoice module config missing.");
  }
  const tbl = escapeSqlTableIdForModuleConfig(mod);
  const seqTable = escapeSqlTableId("module_number_sequence");

  const [rows] = await conn.query(`SELECT id, date FROM ${tbl} WHERE id = ? LIMIT 1`, [recordId]);
  if (!rows?.length) {
    throwVehicleInvoiceValidation("Vehicle Invoice row was not found while generating Invoice No.");
  }

  const yearCode = await resolveYearCodeByDate(conn, rowValueForField(rows[0], "date"));
  // INV/<FY>/#### is shared with recovery and SARFAESI (one serial per year across all three).
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
    throwVehicleInvoiceValidation("Vehicle Invoice sequence row missing.");
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
export async function applyVehicleInvoiceBeforeWrite(conn, { oldRow, merged, childTableRows, user }) {
  const parentData = oldRow ? { ...oldRow, ...merged } : merged;
  const childTotal = sumVehicleInvoiceChargesAmount(childTableRows);
  const unlockOnly =
    oldRow && isInvoiceFinalInvoiceUnlockUpdate(oldRow, merged, { childTotal });
  if (!unlockOnly) {
    await assertVehicleInvoiceDateNotInFrozenFy(conn, parentData, user);
  }
  await assertCaseEligibleForNewInvoice(conn, merged?.caseNo, !oldRow);
  await assertVehicleInvoiceCaseIsVehicleLoan(conn, merged?.caseNo);
  if (merged && "finalInvoice" in merged) {
    merged.finalInvoice = normalizeFinalInvoiceFlag(merged.finalInvoice);
  }
  merged.grandTotal = childTotal;
}

/** After create/update — recompute `new_case_inward.finalInvoice` from all invoice modules. */
export async function afterVehicleInvoiceWrite(conn, ctx) {
  await syncNciFinalInvoiceAfterInvoiceWrite(conn, VEHICLE_INVOICE_MODULE_KEY, ctx);
}
