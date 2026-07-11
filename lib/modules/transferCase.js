/**
 * Transfer Case — server rules. Date must be today; moves case ownership on save; ref TRF/…
 * FY freeze for role 2. UI filters: transferCaseClient.js.
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

const TRANSFER_CASE_SEQUENCE_MODULE_KEY = "transfer_case";

/** Role 2 = unit-scoped operators; role 1 / others are not restricted here. */
const TRANSFER_CASE_LOV_UNIT_RESTRICT_ROLE = 2;

function asPositiveInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function throwTransferCaseValidation(message) {
  throw Object.assign(new Error(message), { code: "TRANSFER_CASE_VALIDATION_FAILED" });
}

function normalizeAllowFlag(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/**
 * If transfer date falls in a Financial Year with Freeze Transactions = Yes, block the save.
 * Mirrors new_case_inward freeze handling (lib/modules/newCaseInward.js).
 */
async function assertTransferDateNotInFrozenFinancialYear(conn, transferDate) {
  const ymd = toYyyyMmDdForSqlDateField(transferDate);
  if (!ymd) return;

  const fy = modules.financial_year_master;
  if (!fy?.table) return;

  const t = escapeSqlTableIdForModuleConfig(fy);
  const [rows] = await conn.query(
    `SELECT freezeTransactions FROM ${t} WHERE ? BETWEEN startDate AND endDate`,
    [ymd]
  );

  const hasFrozenYear = Array.isArray(rows)
    ? rows.some((r) => normalizeAllowFlag(rowValueForField(r, "freezeTransactions")) === "yes")
    : false;
  if (!hasFrozenYear) return;

  throwTransferCaseValidation(
    "Transactions are locked for the selected financial year. Please contact the administrator."
  );
}

/**
 * Transfer Case → Case No picker loads `new_case_inward` via `lov=1` + `transfer_case_case_picker=1`.
 * For role 2, restrict rows to the logged-in user's unit (admins / other roles see the full picker set from SQL below).
 * @param {{ role?: unknown, unit?: unknown } | null | undefined} user
 * @param {{ escapeId: (name: string) => string }} mysql
 * @param {string} mainTableRef — escaped main table id (e.g. from `escapeSqlTableIdForModuleConfig`)
 */
export function appendTransferCaseCasePickerUnitLookupFilter({ user, mysql, mainTableRef, whereParts, whereValues }) {
  if (!user || !mysql || !mainTableRef || !whereParts || !whereValues) return;
  const role = Number(user.role);
  if (!Number.isFinite(role) || role !== TRANSFER_CASE_LOV_UNIT_RESTRICT_ROLE) return;
  const unitId = Number(user.unit != null ? String(user.unit).trim() : NaN);
  if (!Number.isFinite(unitId) || unitId <= 0) {
    // Role 2 with no unit — show empty picker instead of all cases.
    whereParts.push("(0 = 1)");
    return;
  }
  const col = `${mainTableRef}.${mysql.escapeId("unit")}`;
  whereParts.push(`${col} = ?`);
  whereValues.push(unitId);
}

async function loadNewCaseInwardOwnerByCaseId(conn, caseId) {
  const t = escapeSqlTableIdForModuleConfig(modules.new_case_inward);
  const [rows] = await conn.query(`SELECT id, unit FROM ${t} WHERE id = ? LIMIT 1`, [caseId]);
  return rows?.[0] || null;
}

async function assertToUnitIsActive(conn, toUnitId) {
  const um = escapeSqlTableIdForModuleConfig(modules.unit_master);
  const [rows] = await conn.query(
    `SELECT id FROM ${um} WHERE id = ? AND LOWER(TRIM(COALESCE(active, ''))) = 'yes' LIMIT 1`,
    [toUnitId]
  );
  if (!rows?.length) {
    throwTransferCaseValidation("To Unit must be an active unit.");
  }
}

async function assertAssigneeActiveAndBelongsToUnit(conn, assigneeId, toUnitId) {
  const usersTable = escapeSqlTableId("users");
  const [rows] = await conn.query(
    `SELECT id FROM ${usersTable} WHERE id = ? AND unit = ? AND LOWER(TRIM(COALESCE(active, ''))) = 'yes' LIMIT 1`,
    [assigneeId, toUnitId]
  );
  if (!rows?.length) {
    throwTransferCaseValidation(
      "Assignee must be an active user and must belong to the selected To Unit."
    );
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

/**
 * Before save: transfer date must be today, FY freeze for role 2, From Unit matches live NCI owner,
 * To Unit active and different, assignee active in To Unit.
 */
export async function validateTransferCaseBeforeWrite(conn, { parentData, user }) {
  // Business rule: this module is an operational transfer action, so it is allowed only for "today".
  // UI also enforces this, but we re-check on server to prevent API bypass.
  const transferDateYmd = toYyyyMmDdForSqlDateField(parentData?.date);
  const todayYmd = getYmdISTFromInstant(new Date());
  if (!transferDateYmd || transferDateYmd !== todayYmd) {
    throwTransferCaseValidation("Date must be today's date.");
  }

  if (shouldEnforceFreezeTransactionsForUser(user)) {
    await assertDateNotInFrozenFinancialYear(conn, parentData?.date, {
      onBlocked: () => throwTransferCaseValidation(FREEZE_TRANSACTIONS_LOCKED_MESSAGE)
    });
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
  // From Unit is read-only in UI but must match live NCI ownership (prevents stale transfers).
  if (currentUnitId == null || currentUnitId !== fromUnitId) {
    throwTransferCaseValidation("From Unit must match the current owner unit of the selected Case No.");
  }
  if (fromUnitId === toUnitId) {
    throwTransferCaseValidation("To Unit cannot be the same as From Unit.");
  }

  await assertToUnitIsActive(conn, toUnitId);
  await assertAssigneeActiveAndBelongsToUnit(conn, assigneeId, toUnitId);
}

/** CRUD beforeWrite hook — runs validateTransferCaseBeforeWrite on the merged parent row. */
export async function applyTransferCaseBeforeWrite(conn, { oldRow, merged, user }) {
  await validateTransferCaseBeforeWrite(conn, {
    parentData: oldRow ? { ...oldRow, ...merged } : merged,
    user
  });
}

/**
 * Inside the save transaction: move NCI unit/createdBy/modifiedBy to To Unit + Assignee.
 * Returns before/after case snapshots for audit.
 */
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
  // Transfer moves case to new unit; assignee becomes both creator and modifier on NCI.
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

/** Load caseNo / fromUnit / toUnit / assignee for a saved Transfer Case id (post-create ownership move). */
export async function loadTransferCaseOwnershipRowById(conn, transferCaseId) {
  const id = asPositiveInt(transferCaseId);
  if (!id) return null;
  const tcTable = escapeSqlTableIdForModuleConfig(modules.transfer_case);
  const [rows] = await conn.query(`SELECT caseNo, fromUnit, toUnit, assignee FROM ${tcTable} WHERE id = ? LIMIT 1`, [id]);
  return rows?.[0] || null;
}

/** Stamp `refNo` as TRF/&lt;yearCode&gt;/&lt;####&gt; after insert (module_number_sequence). */
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

