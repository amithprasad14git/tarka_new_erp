// Module-specific file: contains business rules for this module only.
// Do not move this logic into generic/shared files.

import { modules } from "../../config/modules";
import { rowValueForField } from "../gridRowValue";
import { getYmdISTFromInstant } from "../istDateTime";
import { escapeSqlTableId, escapeSqlTableIdForModuleConfig } from "../sqlModuleTable";
import { toYyyyMmDdForSqlDateField } from "../sqlDateFieldValue";

const TRANSFER_CASE_SEQUENCE_MODULE_KEY = "transfer_case";

function asPositiveInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function throwTransferCaseValidation(message) {
  throw Object.assign(new Error(message), { code: "TRANSFER_CASE_VALIDATION_FAILED" });
}

async function loadNewCaseInwardOwnerByCaseId(conn, caseId) {
  const t = escapeSqlTableIdForModuleConfig(modules.new_case_inward);
  const [rows] = await conn.query(`SELECT id, unit FROM ${t} WHERE id = ? LIMIT 1`, [caseId]);
  return rows?.[0] || null;
}

async function assertAssigneeBelongsToUnit(conn, assigneeId, toUnitId) {
  const usersTable = escapeSqlTableId("users");
  const [rows] = await conn.query(`SELECT id FROM ${usersTable} WHERE id = ? AND unit = ? LIMIT 1`, [
    assigneeId,
    toUnitId
  ]);
  if (!rows?.length) {
    throwTransferCaseValidation("Assignee must belong to the selected To Unit.");
  }
}

async function resolveTransferYearCodeByDate(conn, transferDate) {
  const ymd = toYyyyMmDdForSqlDateField(transferDate);
  if (!ymd) {
    throwTransferCaseValidation("Transfer Date is required to generate Ref No.");
  }
  const fyTable = escapeSqlTableIdForModuleConfig(modules.financial_year_master);
  const [rows] = await conn.query(
    `SELECT yearCode FROM ${fyTable} WHERE ? BETWEEN startDate AND endDate LIMIT 1`,
    [ymd]
  );
  const yearCode = String(rowValueForField(rows?.[0] || {}, "yearCode") ?? "").trim();
  if (!yearCode) {
    throwTransferCaseValidation("No Financial Year found for selected Transfer Date.");
  }
  return yearCode;
}

export async function validateTransferCaseBeforeWrite(conn, { parentData }) {
  // Business rule: this module is an operational transfer action, so it is allowed only for "today".
  // UI also enforces this, but we re-check on server to prevent API bypass.
  const transferDateYmd = toYyyyMmDdForSqlDateField(parentData?.date);
  const todayYmd = getYmdISTFromInstant(new Date());
  if (!transferDateYmd || transferDateYmd !== todayYmd) {
    throwTransferCaseValidation("Date must be today's date.");
  }

  const caseId = asPositiveInt(parentData?.caseNo);
  if (!caseId) throwTransferCaseValidation("Case No is required.");
  const fromUnitId = asPositiveInt(parentData?.fromUnit);
  if (!fromUnitId) throwTransferCaseValidation("From Unit is required.");
  const toUnitId = asPositiveInt(parentData?.toUnit);
  if (!toUnitId) throwTransferCaseValidation("To Unit is required.");
  const assigneeId = asPositiveInt(parentData?.assignee);
  if (!assigneeId) throwTransferCaseValidation("Assignee is required.");

  const caseRow = await loadNewCaseInwardOwnerByCaseId(conn, caseId);
  if (!caseRow) {
    throwTransferCaseValidation("Selected Case No was not found.");
  }

  const currentUnitId = asPositiveInt(rowValueForField(caseRow, "unit"));
  if (currentUnitId == null || currentUnitId !== fromUnitId) {
    throwTransferCaseValidation("From Unit must match the current owner unit of the selected Case No.");
  }
  if (fromUnitId === toUnitId) {
    throwTransferCaseValidation("To Unit cannot be the same as From Unit.");
  }

  await assertAssigneeBelongsToUnit(conn, assigneeId, toUnitId);
}

export async function applyTransferCaseBeforeWrite(conn, { oldRow, merged }) {
  await validateTransferCaseBeforeWrite(conn, { parentData: oldRow ? { ...oldRow, ...merged } : merged });
}

export async function applyTransferCaseOwnershipInTransaction(conn, transferCaseRow) {
  const caseId = asPositiveInt(transferCaseRow?.caseNo);
  const toUnitId = asPositiveInt(transferCaseRow?.toUnit);
  const assigneeId = asPositiveInt(transferCaseRow?.assignee);
  if (!caseId || !toUnitId || !assigneeId) {
    throwTransferCaseValidation("Case transfer fields are incomplete.");
  }

  const nciTable = escapeSqlTableIdForModuleConfig(modules.new_case_inward);
  // Capture before/after snapshots so caller can write a clean audit trail for the linked case row.
  const [beforeRows] = await conn.query(`SELECT * FROM ${nciTable} WHERE id = ? LIMIT 1`, [caseId]);
  const oldCaseRow = beforeRows?.[0] || null;
  await conn.query(`UPDATE ${nciTable} SET unit = ?, createdBy = ?, modifiedBy = ? WHERE id = ?`, [
    toUnitId,
    assigneeId,
    assigneeId,
    caseId
  ]);
  const [afterRows] = await conn.query(`SELECT * FROM ${nciTable} WHERE id = ? LIMIT 1`, [caseId]);
  return {
    caseId,
    oldCaseRow,
    newCaseRow: afterRows?.[0] || null
  };
}

export async function loadTransferCaseOwnershipRowById(conn, transferCaseId) {
  const id = asPositiveInt(transferCaseId);
  if (!id) return null;
  const tcTable = escapeSqlTableIdForModuleConfig(modules.transfer_case);
  const [rows] = await conn.query(`SELECT caseNo, fromUnit, toUnit, assignee FROM ${tcTable} WHERE id = ? LIMIT 1`, [id]);
  return rows?.[0] || null;
}

export async function assignTransferCaseRefNo(conn, recordId) {
  const tcTable = escapeSqlTableIdForModuleConfig(modules.transfer_case);
  const seqTable = escapeSqlTableId("module_number_sequence");
  const [rows] = await conn.query(`SELECT id, date FROM ${tcTable} WHERE id = ? LIMIT 1`, [recordId]);
  if (!rows?.length) {
    throwTransferCaseValidation("Transfer Case row was not found while generating Ref No.");
  }

  const transferDate = rowValueForField(rows[0], "date");
  const yearCode = await resolveTransferYearCodeByDate(conn, transferDate);
  // Sequence key is year-specific so serial restarts each financial year code.
  const sequencePrefix = `TRF/${yearCode}`;

  await conn.query(
    `INSERT INTO ${seqTable} (module, prefix, lastNumber) VALUES (?, ?, 0)
     ON DUPLICATE KEY UPDATE lastNumber = lastNumber`,
    [TRANSFER_CASE_SEQUENCE_MODULE_KEY, sequencePrefix]
  );

  const [seqRows] = await conn.query(`SELECT lastNumber FROM ${seqTable} WHERE module = ? AND prefix = ? FOR UPDATE`, [
    TRANSFER_CASE_SEQUENCE_MODULE_KEY,
    sequencePrefix
  ]);
  if (!seqRows?.length) {
    throwTransferCaseValidation("Transfer Case sequence row missing.");
  }

  const last = Number(rowValueForField(seqRows[0], "lastNumber"));
  const next = Number.isFinite(last) ? last + 1 : 1;
  const refNo = `TRF/${yearCode}/${String(next).padStart(5, "0")}`;
  await conn.query(`UPDATE ${seqTable} SET lastNumber = ? WHERE module = ? AND prefix = ?`, [
    next,
    TRANSFER_CASE_SEQUENCE_MODULE_KEY,
    sequencePrefix
  ]);
  await conn.query(`UPDATE ${tcTable} SET refNo = ? WHERE id = ? AND (refNo IS NULL OR TRIM(refNo) = '')`, [refNo, recordId]);
}

