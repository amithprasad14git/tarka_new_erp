/**
 * Public Notice — server rules. Date/case/child row checks; FY freeze for role 2; ref PN/… after save.
 * PDF layout: publicNoticePdf.js. UI: publicNoticeClient.js.
 */

import { modules } from "../../config/modules";
import { buildPostCreateAckUpdateBody } from "../postCreateAck";
import { rowValueForField } from "../gridRowValue";
import { getYmdISTFromInstant } from "../istDateTime";
import { escapeSqlTableId, escapeSqlTableIdForModuleConfig } from "../sqlModuleTable";
import { toYyyyMmDdForSqlDateField } from "../sqlDateFieldValue";
import {
  assertDateNotInFrozenFinancialYear,
  FREEZE_TRANSACTIONS_LOCKED_MESSAGE,
  shouldEnforceFreezeTransactionsForUser
} from "./freezeTransactionsLock";

const PUBLIC_NOTICE_SEQUENCE_MODULE_KEY = "public_notice";

function throwPublicNoticeValidation(message) {
  throw Object.assign(new Error(message), { code: "PUBLIC_NOTICE_VALIDATION_FAILED" });
}

function asPositiveInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Public Notice domain rules before create/update (date, FY freeze, case, detail rows).
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {{ parentData: object, childTableRows?: object, user: object }} ctx
 */
export async function validatePublicNoticeBeforeWrite(conn, { parentData, childTableRows, user }) {
  // --- Parent date (not future), FY freeze for unit role, case link, detail rows (max 3) ---
  const ymd = toYyyyMmDdForSqlDateField(parentData?.date);
  if (!ymd) {
    throwPublicNoticeValidation("Date is required.");
  }
  const todayYmd = getYmdISTFromInstant(new Date());
  if (ymd > todayYmd) {
    throwPublicNoticeValidation("Date cannot be greater than today.");
  }

  if (shouldEnforceFreezeTransactionsForUser(user)) {
    await assertDateNotInFrozenFinancialYear(conn, parentData?.date, {
      onBlocked: () => throwPublicNoticeValidation(FREEZE_TRANSACTIONS_LOCKED_MESSAGE)
    });
  }

  const caseId = asPositiveInt(parentData?.caseNo);
  if (!caseId) {
    throwPublicNoticeValidation("Case No is required.");
  }

  const rows = Array.isArray(childTableRows?.public_notice_details)
    ? childTableRows.public_notice_details
    : [];
  // At least one party named on the notice; each partially filled row needs type + display name.
  if (rows.length > 3) {
    throwPublicNoticeValidation("A maximum of 3 rows is allowed in Public Notice Details.");
  }
  const hasAtLeastOneDisplayName = rows.some((row) => String(row?.displayName ?? "").trim() !== "");
  if (!hasAtLeastOneDisplayName) {
    throwPublicNoticeValidation("At least one Display Name is required.");
  }
  for (const row of rows) {
    const hasAnyContent =
      String(row?.displayName ?? "").trim() !== "" ||
      String(row?.type ?? "").trim() !== "" ||
      String(row?.address ?? "").trim() !== "";
    if (!hasAnyContent) continue;
    const hasType =
      row?.type != null &&
      String(row.type).trim() !== "" &&
      Number.isFinite(Number(row.type)) &&
      Number(row.type) > 0;
    if (!hasType) {
      throwPublicNoticeValidation("Type is required for each filled Public Notice Details row.");
    }
    if (String(row?.displayName ?? "").trim() === "") {
      throwPublicNoticeValidation("Display Name is required for each filled Public Notice Details row.");
    }
  }

  const nciTable = escapeSqlTableIdForModuleConfig(modules.new_case_inward);
  const [caseRows] = await conn.query(`SELECT id FROM ${nciTable} WHERE id = ? LIMIT 1`, [caseId]);
  if (!caseRows?.length) {
    throwPublicNoticeValidation("Selected Case No was not found.");
  }
}

/**
 * CRUD beforeWrite entry: merge row then run Public Notice validations.
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {{ oldRow?: object | null, merged: object, childTableRows?: object, user: object }} ctx
 */
export async function applyPublicNoticeBeforeWrite(conn, { oldRow, merged, childTableRows, user }) {
  await validatePublicNoticeBeforeWrite(conn, {
    parentData: oldRow ? { ...oldRow, ...merged } : merged,
    childTableRows,
    user
  });
}

/** Build post-update acknowledgement body (ref no) for the generic ack modal. */
export function buildPublicNoticeUpdateAckBody(moduleConfig, id, savedRow) {
  return buildPostCreateAckUpdateBody(moduleConfig, id, savedRow);
}

async function resolveYearCodeByDate(conn, noticeDate) {
  const ymd = toYyyyMmDdForSqlDateField(noticeDate);
  if (!ymd) {
    throwPublicNoticeValidation("Date is required to generate Ref No.");
  }
  const fyTable = escapeSqlTableIdForModuleConfig(modules.financial_year_master);
  const [rows] = await conn.query(
    `SELECT yearCode FROM ${fyTable} WHERE ? BETWEEN startDate AND endDate LIMIT 1`,
    [ymd]
  );
  const yearCode = String(rowValueForField(rows?.[0] || {}, "yearCode") ?? "").trim();
  if (!yearCode) {
    throwPublicNoticeValidation("No Financial Year found for selected Date.");
  }
  return yearCode;
}

/**
 * Stamp refNo as PN/&lt;yearCode&gt;/&lt;5-digit serial&gt; after INSERT.
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {number} recordId
 */
export async function assignPublicNoticeRefNo(conn, recordId) {
  // --- Reference PN/<yearCode>/##### after INSERT (5-digit serial per FY) ---
  const pnTable = escapeSqlTableIdForModuleConfig(modules.public_notice);
  const seqTable = escapeSqlTableId("module_number_sequence");
  const [rows] = await conn.query(`SELECT id, date FROM ${pnTable} WHERE id = ? LIMIT 1`, [recordId]);
  if (!rows?.length) {
    throwPublicNoticeValidation("Public Notice row was not found while generating Ref No.");
  }

  const yearCode = await resolveYearCodeByDate(conn, rowValueForField(rows[0], "date"));
  const sequencePrefix = `PN/${yearCode}`;

  await conn.query(
    `INSERT INTO ${seqTable} (module, prefix, lastNumber) VALUES (?, ?, 0)
     ON DUPLICATE KEY UPDATE lastNumber = lastNumber`,
    [PUBLIC_NOTICE_SEQUENCE_MODULE_KEY, sequencePrefix]
  );

  const [seqRows] = await conn.query(`SELECT lastNumber FROM ${seqTable} WHERE module = ? AND prefix = ? FOR UPDATE`, [
    PUBLIC_NOTICE_SEQUENCE_MODULE_KEY,
    sequencePrefix
  ]);
  if (!seqRows?.length) {
    throwPublicNoticeValidation("Public Notice sequence row missing.");
  }

  const last = Number(rowValueForField(seqRows[0], "lastNumber"));
  const next = Number.isFinite(last) ? last + 1 : 1;
  const refNo = `PN/${yearCode}/${String(next).padStart(5, "0")}`;

  await conn.query(`UPDATE ${seqTable} SET lastNumber = ? WHERE module = ? AND prefix = ?`, [
    next,
    PUBLIC_NOTICE_SEQUENCE_MODULE_KEY,
    sequencePrefix
  ]);
  await conn.query(`UPDATE ${pnTable} SET refNo = ? WHERE id = ? AND (refNo IS NULL OR TRIM(refNo) = '')`, [refNo, recordId]);
}

