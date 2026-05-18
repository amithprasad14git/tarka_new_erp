/**
 * Invoices Received — server-side rules only (no React imports).
 *
 * Ref no IR/<FY>/<####>, FY freeze for role 2, exactly one invoice FK,
 * duplicate-invoice guard, picker exclusion on invoice list APIs.
 * TDS / received amounts are computed client-side only.
 *
 * UI: invoicesReceivedClient.js
 */

import { modules } from "../../config/modules";
import { rowValueForField } from "../gridRowValue";
import { getYmdISTFromInstant } from "../istDateTime";
import { escapeSqlTableId, escapeSqlTableIdForModuleConfig } from "../sqlModuleTable";
import { toYyyyMmDdForSqlDateField } from "../sqlDateFieldValue";
import {
  assertDateNotInFrozenFinancialYear,
  FREEZE_TRANSACTIONS_LOCKED_MESSAGE,
  shouldEnforceFreezeTransactionsForUser
} from "./freezeTransactionsLock";

export const INVOICES_RECEIVED_MODULE_KEY = "invoices_received";

export const INVOICES_RECEIVED_RECOVERY_PICKER_LOV_PARAM = "invoices_received_recovery_picker";
export const INVOICES_RECEIVED_SARFAESI_PICKER_LOV_PARAM = "invoices_received_sarfaesi_picker";
export const INVOICES_RECEIVED_VEHICLE_PICKER_LOV_PARAM = "invoices_received_vehicle_picker";

const SEQUENCE_MODULE_KEY = INVOICES_RECEIVED_MODULE_KEY;

const INVOICE_FK_FIELDS = [
  { field: "recoveryInvoice", moduleKey: "recovery_invoice", label: "Recovery Invoice" },
  { field: "sarfaesiInvoice", moduleKey: "sarfaesi_invoice", label: "SARFAESI Invoice" },
  { field: "vehicleInvoice", moduleKey: "vehicle_invoice", label: "Vehicle Invoice" }
];

function throwInvoicesReceivedValidation(message) {
  throw Object.assign(new Error(message), { code: "INVOICES_RECEIVED_VALIDATION_FAILED" });
}

function asPositiveInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function resolveSelectedInvoice(parentData) {
  const selected = [];
  for (const { field, moduleKey, label } of INVOICE_FK_FIELDS) {
    const id = asPositiveInt(parentData?.[field]);
    if (id) selected.push({ field, moduleKey, label, id });
  }
  return selected;
}

function appendInvoicesReceivedInvoicePickerFilter({
  mysql,
  mainTableRef,
  whereParts,
  whereValues,
  parentRecordId,
  fkColumnName
}) {
  if (!mysql || !mainTableRef || !whereParts || !whereValues || !fkColumnName) return;

  const irTable = escapeSqlTableIdForModuleConfig(modules.invoices_received);
  if (!irTable) return;

  const invoiceIdRef = `${mainTableRef}.${mysql.escapeId("id")}`;
  const fkCol = mysql.escapeId(fkColumnName);
  const parentId = asPositiveInt(parentRecordId);

  if (parentId) {
    whereParts.push(
      `NOT EXISTS (
        SELECT 1 FROM ${irTable} ir
        WHERE ir.${fkCol} = ${invoiceIdRef}
          AND ir.${fkCol} IS NOT NULL
          AND ir.${mysql.escapeId("id")} <> ?
      )`
    );
    whereValues.push(parentId);
  } else {
    whereParts.push(
      `NOT EXISTS (
        SELECT 1 FROM ${irTable} ir
        WHERE ir.${fkCol} = ${invoiceIdRef}
          AND ir.${fkCol} IS NOT NULL
      )`
    );
  }
}

export function appendInvoicesReceivedRecoveryInvoicePickerFilter(opts) {
  appendInvoicesReceivedInvoicePickerFilter({ ...opts, fkColumnName: "recoveryInvoice" });
}

export function appendInvoicesReceivedSarfaesiInvoicePickerFilter(opts) {
  appendInvoicesReceivedInvoicePickerFilter({ ...opts, fkColumnName: "sarfaesiInvoice" });
}

export function appendInvoicesReceivedVehicleInvoicePickerFilter(opts) {
  appendInvoicesReceivedInvoicePickerFilter({ ...opts, fkColumnName: "vehicleInvoice" });
}

async function assertReceivedDateNotInFrozenFy(conn, parentData, user) {
  if (!shouldEnforceFreezeTransactionsForUser(user)) return;
  await assertDateNotInFrozenFinancialYear(conn, parentData?.receivedDate, {
    onBlocked: () => throwInvoicesReceivedValidation(FREEZE_TRANSACTIONS_LOCKED_MESSAGE)
  });
}

async function assertInvoiceNotAlreadyUsed(conn, fkField, invoiceId, parentRecordId, label) {
  const irTable = escapeSqlTableIdForModuleConfig(modules.invoices_received);
  const dupParams = [invoiceId];
  let dupSql = `SELECT id FROM ${irTable} WHERE ${fkField} = ?`;
  const pr = asPositiveInt(parentRecordId);
  if (pr) {
    dupSql += ` AND id <> ?`;
    dupParams.push(pr);
  }
  dupSql += ` LIMIT 1`;
  const [dupRows] = await conn.query(dupSql, dupParams);
  if (dupRows?.length) {
    throwInvoicesReceivedValidation(
      `This ${label} is already recorded on another Invoices Received entry.`
    );
  }
}

async function assertInvoiceExists(conn, moduleKey, invoiceId, label) {
  const invTable = escapeSqlTableIdForModuleConfig(modules[moduleKey]);
  if (!invTable) {
    throwInvoicesReceivedValidation(`Invoice module ${moduleKey} is not configured.`);
  }
  const [rows] = await conn.query(`SELECT id FROM ${invTable} WHERE id = ? LIMIT 1`, [invoiceId]);
  if (!rows?.length) {
    throwInvoicesReceivedValidation(`Selected ${label} was not found.`);
  }
}

export async function validateInvoicesReceivedBeforeWrite(conn, {
  parentData,
  parentRecordId = null,
  user
}) {
  const ymd = toYyyyMmDdForSqlDateField(parentData?.receivedDate);
  if (!ymd) {
    throwInvoicesReceivedValidation("Received Date is required.");
  }
  const todayYmd = getYmdISTFromInstant(new Date());
  if (ymd > todayYmd) {
    throwInvoicesReceivedValidation("Received Date cannot be greater than today.");
  }

  await assertReceivedDateNotInFrozenFy(conn, parentData, user);

  const selected = resolveSelectedInvoice(parentData);
  if (selected.length === 0) {
    throwInvoicesReceivedValidation(
      "Select exactly one of Recovery Invoice, SARFAESI Invoice, or Vehicle Invoice."
    );
  }
  if (selected.length > 1) {
    throwInvoicesReceivedValidation(
      "Only one invoice may be selected per entry (Recovery, SARFAESI, or Vehicle)."
    );
  }

  const { field, moduleKey, label, id } = selected[0];
  await assertInvoiceExists(conn, moduleKey, id, label);
  await assertInvoiceNotAlreadyUsed(conn, field, id, parentRecordId, label);
}

export async function applyInvoicesReceivedBeforeWrite(conn, {
  oldRow,
  merged,
  parentRecordId = null,
  user
}) {
  await validateInvoicesReceivedBeforeWrite(conn, {
    parentData: oldRow ? { ...oldRow, ...merged } : merged,
    parentRecordId,
    user
  });
}

async function resolveYearCodeByDate(conn, bizDate) {
  const ymd = toYyyyMmDdForSqlDateField(bizDate);
  if (!ymd) {
    throwInvoicesReceivedValidation("Received Date is required to generate Ref No.");
  }
  const fyTable = escapeSqlTableIdForModuleConfig(modules.financial_year_master);
  const [rows] = await conn.query(
    `SELECT yearCode FROM ${fyTable} WHERE ? BETWEEN startDate AND endDate LIMIT 1`,
    [ymd]
  );
  const yearCode = String(rowValueForField(rows?.[0] || {}, "yearCode") ?? "").trim();
  if (!yearCode) {
    throwInvoicesReceivedValidation("No Financial Year found for selected Received Date.");
  }
  return yearCode;
}

export async function assignInvoicesReceivedRefNo(conn, recordId) {
  const parentTable = escapeSqlTableIdForModuleConfig(modules.invoices_received);
  const seqTable = escapeSqlTableId("module_number_sequence");
  const [rows] = await conn.query(
    `SELECT id, receivedDate FROM ${parentTable} WHERE id = ? LIMIT 1`,
    [recordId]
  );
  if (!rows?.length) {
    throwInvoicesReceivedValidation("Invoices Received row was not found while generating Ref No.");
  }

  const yearCode = await resolveYearCodeByDate(conn, rowValueForField(rows[0], "receivedDate"));
  const sequencePrefix = `IR/${yearCode}`;

  await conn.query(
    `INSERT INTO ${seqTable} (module, prefix, lastNumber) VALUES (?, ?, 0)
     ON DUPLICATE KEY UPDATE lastNumber = lastNumber`,
    [SEQUENCE_MODULE_KEY, sequencePrefix]
  );

  const [seqRows] = await conn.query(
    `SELECT lastNumber FROM ${seqTable} WHERE module = ? AND prefix = ? FOR UPDATE`,
    [SEQUENCE_MODULE_KEY, sequencePrefix]
  );
  if (!seqRows?.length) {
    throwInvoicesReceivedValidation("Invoices Received sequence row missing.");
  }

  const last = Number(rowValueForField(seqRows[0], "lastNumber"));
  const next = Number.isFinite(last) ? last + 1 : 1;
  const refNo = `IR/${yearCode}/${String(next).padStart(4, "0")}`;

  await conn.query(`UPDATE ${seqTable} SET lastNumber = ? WHERE module = ? AND prefix = ?`, [
    next,
    SEQUENCE_MODULE_KEY,
    sequencePrefix
  ]);
  await conn.query(`UPDATE ${parentTable} SET refNo = ? WHERE id = ? AND (refNo IS NULL OR TRIM(refNo) = '')`, [
    refNo,
    recordId
  ]);
}
