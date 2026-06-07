/**
 * SARFAESI Case Status Update — server-side rules only (no React imports).
 *
 * On save: validates date, case (SARFAESI loan only, not already used), child particulars,
 * optional remarks, and FY freeze for role 2. After create, stamps ref no `SRFUP/<FY>/<####>`.
 * Case picker SQL filter: `appendSarfaesiCaseStatusUpdateCasePickerFilter` (used from CRUD list API).
 *
 * UI behaviour lives in `sarfaesiCaseStatusUpdateClient.js` (must not import this file — mysql2).
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
import {
  appendSarfaesiInvoiceCasePickerLoanCategoryFilter,
  SARFAESI_INVOICE_LOAN_CATEGORY_LOOKUP_TYPE,
  SARFAESI_INVOICE_LOAN_CATEGORY_LOOKUP_VALUE
} from "./sarfaesiInvoice";

export const SARFAESI_CASE_STATUS_UPDATE_MODULE_KEY = "sarfaesi_case_status_update";
export const SARFAESI_CASE_STATUS_UPDATE_DETAILS_CHILD_KEY = "sarfaesi_case_status_update_details";
export const SARFAESI_CASE_STATUS_UPDATE_CASE_PICKER_LOV_PARAM = "sarfaesi_case_status_update_case_picker";

const SEQUENCE_MODULE_KEY = SARFAESI_CASE_STATUS_UPDATE_MODULE_KEY;

function throwSarfaesiCaseStatusUpdateValidation(message) {
  throw Object.assign(new Error(message), { code: "SARFAESI_CASE_STATUS_UPDATE_VALIDATION_FAILED" });
}

function asPositiveInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Case No picker on `new_case_inward`: SARFAESI loan category only; exclude cases already on another parent row.
 */
export function appendSarfaesiCaseStatusUpdateCasePickerFilter({
  mysql,
  mainTableRef,
  whereParts,
  whereValues,
  parentRecordId
}) {
  if (!mysql || !mainTableRef || !whereParts || !whereValues) return;

  // Case picker: SARFAESI loan category only (same rule as SARFAESI invoice).
  appendSarfaesiInvoiceCasePickerLoanCategoryFilter({ mysql, mainTableRef, whereParts, whereValues });

  const parentTable = escapeSqlTableIdForModuleConfig(modules.sarfaesi_case_status_update);
  if (!parentTable) return;

  const nciRef = `${mainTableRef}.${mysql.escapeId("id")}`;
  // One status-update record per case; when editing, keep the current case in the list.
  const parentId = asPositiveInt(parentRecordId);
  if (parentId) {
    whereParts.push(
      `NOT EXISTS (
        SELECT 1 FROM ${parentTable} scsu
        WHERE scsu.${mysql.escapeId("caseNo")} = ${nciRef}
          AND scsu.${mysql.escapeId("id")} <> ?
      )`
    );
    whereValues.push(parentId);
  } else {
    whereParts.push(
      `NOT EXISTS (SELECT 1 FROM ${parentTable} scsu WHERE scsu.${mysql.escapeId("caseNo")} = ${nciRef})`
    );
  }
}

async function assertCaseIsSarfaesiLoan(conn, caseIdRaw) {
  const caseId = asPositiveInt(caseIdRaw);
  if (!caseId) {
    throwSarfaesiCaseStatusUpdateValidation("Case No is required.");
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
    throwSarfaesiCaseStatusUpdateValidation("Case No must be a SARFAESI loan category case.");
  }
}

async function assertCaseNotAlreadyUsed(conn, caseId, parentRecordId) {
  const parentTable = escapeSqlTableIdForModuleConfig(modules.sarfaesi_case_status_update);
  const dupParams = [caseId];
  let dupSql = `SELECT id FROM ${parentTable} WHERE caseNo = ?`;
  const pr = asPositiveInt(parentRecordId);
  if (pr) {
    dupSql += ` AND id <> ?`;
    dupParams.push(pr);
  }
  dupSql += ` LIMIT 1`;
  const [dupRows] = await conn.query(dupSql, dupParams);
  if (dupRows?.length) {
    throwSarfaesiCaseStatusUpdateValidation(
      "This Case No is already used on another SARFAESI Case Status Update record."
    );
  }
}

async function assertSarfaesiCaseStatusUpdateDateNotInFrozenFy(conn, parentData, user) {
  // Unit operators (role 2) cannot post into a frozen financial year; admins can.
  if (!shouldEnforceFreezeTransactionsForUser(user)) return;
  await assertDateNotInFrozenFinancialYear(conn, parentData?.date, {
    onBlocked: () => throwSarfaesiCaseStatusUpdateValidation(FREEZE_TRANSACTIONS_LOCKED_MESSAGE)
  });
}

function validateChildRows(childTableRows) {
  const rows = Array.isArray(childTableRows?.[SARFAESI_CASE_STATUS_UPDATE_DETAILS_CHILD_KEY])
    ? childTableRows[SARFAESI_CASE_STATUS_UPDATE_DETAILS_CHILD_KEY]
    : [];
  if (!rows.length) {
    throwSarfaesiCaseStatusUpdateValidation("At least one Details row is required.");
  }
  for (const row of rows) {
    const particularsId = asPositiveInt(row?.particulars);
    if (!particularsId) {
      throwSarfaesiCaseStatusUpdateValidation("Particulars is required for each Details row.");
    }
  }
}

async function assertParticularsAreActive(conn, childTableRows) {
  const rows = Array.isArray(childTableRows?.[SARFAESI_CASE_STATUS_UPDATE_DETAILS_CHILD_KEY])
    ? childTableRows[SARFAESI_CASE_STATUS_UPDATE_DETAILS_CHILD_KEY]
    : [];
  const ids = [...new Set(rows.map((r) => asPositiveInt(r?.particulars)).filter(Boolean))];
  if (!ids.length) return;

  // Every particulars id on the form must still be Active = Yes in master.
  const pt = escapeSqlTableIdForModuleConfig(modules.sarfaesi_case_particulars);
  const placeholders = ids.map(() => "?").join(", ");
  const [activeRows] = await conn.query(
    `SELECT id FROM ${pt}
     WHERE id IN (${placeholders})
       AND LOWER(TRIM(COALESCE(active, ''))) = 'yes'`,
    ids
  );
  if ((activeRows || []).length !== ids.length) {
    throwSarfaesiCaseStatusUpdateValidation(
      "Each Particulars value must be an active SARFAESI Case Particulars record."
    );
  }
}

export async function validateSarfaesiCaseStatusUpdateBeforeWrite(conn, {
  parentData,
  childTableRows,
  parentRecordId = null,
  user
}) {
  // --- Date, FY freeze, SARFAESI case only, one update per case, active particulars rows ---
  const ymd = toYyyyMmDdForSqlDateField(parentData?.date);
  if (!ymd) {
    throwSarfaesiCaseStatusUpdateValidation("Date is required.");
  }
  // Back-dated or future-dated entries are not allowed.
  const todayYmd = getYmdISTFromInstant(new Date());
  if (ymd > todayYmd) {
    throwSarfaesiCaseStatusUpdateValidation("Date cannot be greater than today.");
  }

  await assertSarfaesiCaseStatusUpdateDateNotInFrozenFy(conn, parentData, user);

  const caseId = asPositiveInt(parentData?.caseNo);
  await assertCaseIsSarfaesiLoan(conn, caseId);
  await assertCaseNotAlreadyUsed(conn, caseId, parentRecordId);

  const nciTable = escapeSqlTableIdForModuleConfig(modules.new_case_inward);
  const [caseRows] = await conn.query(`SELECT id FROM ${nciTable} WHERE id = ? LIMIT 1`, [caseId]);
  if (!caseRows?.length) {
    throwSarfaesiCaseStatusUpdateValidation("Selected Case No was not found.");
  }

  validateChildRows(childTableRows);
  await assertParticularsAreActive(conn, childTableRows);
}

export async function applySarfaesiCaseStatusUpdateBeforeWrite(conn, {
  oldRow,
  merged,
  childTableRows,
  parentRecordId = null,
  user
}) {
  await validateSarfaesiCaseStatusUpdateBeforeWrite(conn, {
    parentData: oldRow ? { ...oldRow, ...merged } : merged,
    childTableRows,
    parentRecordId,
    user
  });
}

async function resolveYearCodeByDate(conn, bizDate) {
  const ymd = toYyyyMmDdForSqlDateField(bizDate);
  if (!ymd) {
    throwSarfaesiCaseStatusUpdateValidation("Date is required to generate Ref No.");
  }
  const fyTable = escapeSqlTableIdForModuleConfig(modules.financial_year_master);
  const [rows] = await conn.query(
    `SELECT yearCode FROM ${fyTable} WHERE ? BETWEEN startDate AND endDate LIMIT 1`,
    [ymd]
  );
  const yearCode = String(rowValueForField(rows?.[0] || {}, "yearCode") ?? "").trim();
  if (!yearCode) {
    throwSarfaesiCaseStatusUpdateValidation("No Financial Year found for selected Date.");
  }
  return yearCode;
}

export async function assignSarfaesiCaseStatusUpdateRefNo(conn, recordId) {
  // --- Ref SRFUP/<yearCode>/#### after INSERT ---
  const parentTable = escapeSqlTableIdForModuleConfig(modules.sarfaesi_case_status_update);
  const seqTable = escapeSqlTableId("module_number_sequence");
  const [rows] = await conn.query(`SELECT id, date FROM ${parentTable} WHERE id = ? LIMIT 1`, [recordId]);
  if (!rows?.length) {
    throwSarfaesiCaseStatusUpdateValidation(
      "SARFAESI Case Status Update row was not found while generating Ref No."
    );
  }

  const yearCode = await resolveYearCodeByDate(conn, rowValueForField(rows[0], "date"));
  // Ref no restarts each FY: SRFUP/<yearCode>/####.
  const sequencePrefix = `SRFUP/${yearCode}`;

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
    throwSarfaesiCaseStatusUpdateValidation("SARFAESI Case Status Update sequence row missing.");
  }

  const last = Number(rowValueForField(seqRows[0], "lastNumber"));
  const next = Number.isFinite(last) ? last + 1 : 1;
  const refNo = `SRFUP/${yearCode}/${String(next).padStart(4, "0")}`;

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
