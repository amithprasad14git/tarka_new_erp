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
import { queryWithRetry } from "../db";
import mysql from "mysql2";
import { escapeSqlTableId, escapeSqlTableIdForModuleConfig } from "../sqlModuleTable";
import { toYyyyMmDdForSqlDateField } from "../sqlDateFieldValue";
import {
  assertDateNotInFrozenFinancialYear,
  FREEZE_TRANSACTIONS_LOCKED_MESSAGE,
  shouldEnforceFreezeTransactionsForUser
} from "./freezeTransactionsLock";

/** Config key for this module in config/modules.js. */
export const INVOICES_RECEIVED_MODULE_KEY = "invoices_received";

/**
 * Align with `invoices_received.postCreateAck` in config/modules.js.
 */
export const INVOICES_RECEIVED_POST_CREATE_ACK_CONFIG = {
  field: "refNo",
  title: "Invoice Received saved",
  hint: "Your reference number is shown below. Continue to enter another record.",
  valueLabel: "Ref No",
  showPrintPdf: false,
  showCopyButton: false
};

/** LoV query flag: recovery invoice picker for Invoices Received. */
export const INVOICES_RECEIVED_RECOVERY_PICKER_LOV_PARAM = "invoices_received_recovery_picker";
/** LoV query flag: SARFAESI invoice picker for Invoices Received. */
export const INVOICES_RECEIVED_SARFAESI_PICKER_LOV_PARAM = "invoices_received_sarfaesi_picker";
/** LoV query flag: vehicle invoice picker for Invoices Received. */
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

/**
 * Mutates invoice FK columns on a row/payload: non-positive ids become SQL NULL.
 *
 * @param {Record<string, unknown>|null|undefined} row
 */
export function normalizeInvoicesReceivedInvoiceFkFields(row) {
  if (!row || typeof row !== "object") return row;
  for (const { field } of INVOICE_FK_FIELDS) {
    const id = asPositiveInt(row[field]);
    row[field] = id ?? null;
  }
  return row;
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
  // Each invoice can appear on at most one Invoices Received row.
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

  const cancelledCol = mysql.escapeId("cancelledInvoice");
  whereParts.push(
    `(${cancelledCol} IS NULL OR LOWER(TRIM(${cancelledCol})) <> ?)`
  );
  whereValues.push("yes");
}

/** LoV filter: recovery invoices not already linked to another Invoices Received row. */
export function appendInvoicesReceivedRecoveryInvoicePickerFilter(opts) {
  appendInvoicesReceivedInvoicePickerFilter({ ...opts, fkColumnName: "recoveryInvoice" });
}

/** LoV filter: SARFAESI invoices not already linked to another Invoices Received row. */
export function appendInvoicesReceivedSarfaesiInvoicePickerFilter(opts) {
  appendInvoicesReceivedInvoicePickerFilter({ ...opts, fkColumnName: "sarfaesiInvoice" });
}

/** LoV filter: vehicle invoices not already linked to another Invoices Received row. */
export function appendInvoicesReceivedVehicleInvoicePickerFilter(opts) {
  appendInvoicesReceivedInvoicePickerFilter({ ...opts, fkColumnName: "vehicleInvoice" });
}

/**
 * True when GET list is an Invoices Received invoice LoV picker (recovery / SARFAESI / vehicle).
 *
 * @param {string} moduleKey
 * @param {URLSearchParams} searchParams
 */
export function isInvoicesReceivedInvoicePickerList(moduleKey, searchParams) {
  if (!searchParams) return false;
  if (
    moduleKey === "recovery_invoice" &&
    searchParams.get(INVOICES_RECEIVED_RECOVERY_PICKER_LOV_PARAM) === "1"
  ) {
    return true;
  }
  if (
    moduleKey === "sarfaesi_invoice" &&
    searchParams.get(INVOICES_RECEIVED_SARFAESI_PICKER_LOV_PARAM) === "1"
  ) {
    return true;
  }
  if (
    moduleKey === "vehicle_invoice" &&
    searchParams.get(INVOICES_RECEIVED_VEHICLE_PICKER_LOV_PARAM) === "1"
  ) {
    return true;
  }
  return false;
}

/**
 * LEFT JOIN new_case_inward for Invoices Received invoice picker list SQL.
 *
 * @param {string} mainTableRef — escaped invoice table id (e.g. `recovery_invoice`)
 * @returns {{ selectExtra: string, fromJoin: string }}
 */
export function invoicesReceivedInvoicePickerJoinParts(mainTableRef) {
  const nciTable = escapeSqlTableIdForModuleConfig(modules.new_case_inward);
  if (!nciTable || !mainTableRef) {
    return { selectExtra: "", fromJoin: "" };
  }
  const nciAlias = "nci_ir_picker";
  const idCol = mysql.escapeId("id");
  const caseNoCol = mysql.escapeId("caseNo");
  const borrowerCol = mysql.escapeId("borrower");
  return {
    selectExtra: `, ${nciAlias}.${borrowerCol} AS ${borrowerCol}`,
    fromJoin: ` LEFT JOIN ${nciTable} ${nciAlias} ON ${nciAlias}.${idCol} = ${mainTableRef}.${caseNoCol}`
  };
}

function resolveInvoicePickerCaseId(row) {
  const raw = rowValueForField(row, "caseNo");
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Adds linked NCI borrower for Invoices Received invoice picker rows (no row scope).
 * Fallback when list SQL does not already JOIN borrower.
 *
 * @param {Array<Record<string, unknown>>} rows
 */
export async function enrichInvoicesReceivedInvoicePickerRows(rows) {
  if (!rows?.length) return rows;

  const caseIds = [
    ...new Set(rows.map((r) => resolveInvoicePickerCaseId(r)).filter((id) => id != null))
  ];

  const borrowerByCaseId = {};
  if (caseIds.length) {
    const nciTable = escapeSqlTableIdForModuleConfig(modules.new_case_inward);
    if (nciTable) {
      const placeholders = caseIds.map(() => "?").join(",");
      const [nciRows] = await queryWithRetry(
        `SELECT id, borrower FROM ${nciTable} WHERE id IN (${placeholders})`,
        caseIds
      );
      for (const r of nciRows || []) {
        const id = r?.id;
        if (id == null) continue;
        borrowerByCaseId[String(id)] =
          r.borrower != null && String(r.borrower).trim() !== "" ? String(r.borrower).trim() : "";
      }
    }
  }

  for (const row of rows) {
    const caseId = resolveInvoicePickerCaseId(row);
    if (caseId == null) {
      if (row.borrower == null) row.borrower = "";
      continue;
    }
    const borrower = borrowerByCaseId[String(caseId)] ?? "";
    if (borrower || row.borrower == null || String(row.borrower).trim() === "") {
      row.borrower = borrower;
    }
  }

  return rows;
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

/**
 * Validate Invoices Received save: date, FY freeze, exactly one invoice FK, no duplicates.
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {{ parentData: object, parentRecordId?: number | null, user: object }} ctx
 */
export async function validateInvoicesReceivedBeforeWrite(conn, {
  parentData,
  parentRecordId = null,
  user
}) {
  const ymd = toYyyyMmDdForSqlDateField(parentData?.receivedDate);
  if (!ymd) {
    throwInvoicesReceivedValidation("Received Date is required.");
  }
  // Cannot record payment received on a future date.
  const todayYmd = getYmdISTFromInstant(new Date());
  if (ymd > todayYmd) {
    throwInvoicesReceivedValidation("Received Date cannot be greater than today.");
  }

  await assertReceivedDateNotInFrozenFy(conn, parentData, user);

  // Staff pick exactly one of Recovery / SARFAESI / Vehicle invoice FK — not zero, not two.
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

/**
 * CRUD beforeWrite: normalize FKs then validate.
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {{ oldRow?: object | null, merged: object, parentRecordId?: number | null, user: object }} ctx
 */
export async function applyInvoicesReceivedBeforeWrite(conn, {
  oldRow,
  merged,
  parentRecordId = null,
  user
}) {
  if (merged) normalizeInvoicesReceivedInvoiceFkFields(merged);
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

/**
 * Stamp refNo as IR/&lt;yearCode&gt;/&lt;4-digit serial&gt; after INSERT.
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {number} recordId
 */
export async function assignInvoicesReceivedRefNo(conn, recordId) {
  // --- Ref IR/<yearCode>/#### after INSERT ---
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
  // Ref no IR/<FY>/<####> — serial restarts per financial year code.
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
