// Module-specific file: contains business rules for this module only.
// Do not move this logic into generic/shared files.

import { modules } from "../../config/modules";
import { rowValueForField } from "../gridRowValue";
import { getYmdISTFromInstant } from "../istDateTime";
import { escapeSqlTableId, escapeSqlTableIdForModuleConfig } from "../sqlModuleTable";
import { toYyyyMmDdForSqlDateField } from "../sqlDateFieldValue";

const PUBLIC_NOTICE_SEQUENCE_MODULE_KEY = "public_notice";

function throwPublicNoticeValidation(message) {
  throw Object.assign(new Error(message), { code: "PUBLIC_NOTICE_VALIDATION_FAILED" });
}

function normalizeAllowFlag(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/**
 * If notice date falls in a Financial Year with Freeze Transactions = Yes, block the save.
 * Same rule as new_case_inward and transfer_case.
 */
async function assertPublicNoticeDateNotInFrozenFinancialYear(conn, noticeDate) {
  const ymd = toYyyyMmDdForSqlDateField(noticeDate);
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

  throwPublicNoticeValidation(
    "Transactions are locked for the selected financial year. Please contact the administrator."
  );
}

function asPositiveInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function validatePublicNoticeBeforeWrite(conn, { parentData, childTableRows }) {
  const ymd = toYyyyMmDdForSqlDateField(parentData?.date);
  if (!ymd) {
    throwPublicNoticeValidation("Date is required.");
  }
  const todayYmd = getYmdISTFromInstant(new Date());
  if (ymd > todayYmd) {
    throwPublicNoticeValidation("Date cannot be greater than today.");
  }

  await assertPublicNoticeDateNotInFrozenFinancialYear(conn, parentData?.date);

  const caseId = asPositiveInt(parentData?.caseNo);
  if (!caseId) {
    throwPublicNoticeValidation("Case No is required.");
  }

  const rows = Array.isArray(childTableRows?.public_notice_details)
    ? childTableRows.public_notice_details
    : [];
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

export async function applyPublicNoticeBeforeWrite(conn, { oldRow, merged, childTableRows }) {
  await validatePublicNoticeBeforeWrite(conn, {
    parentData: oldRow ? { ...oldRow, ...merged } : merged,
    childTableRows
  });
}

export function buildPublicNoticeUpdateAckBody(moduleConfig, id, savedRow) {
  const body = { ok: true, id: Number(id) };
  const ackCfg = moduleConfig?.postCreateAck;
  if (!ackCfg?.field) return body;
  const raw = savedRow?.[ackCfg.field];
  if (raw != null && String(raw).trim() !== "") {
    body.postCreateAck = { field: ackCfg.field, value: String(raw) };
  }
  return body;
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

export async function assignPublicNoticeRefNo(conn, recordId) {
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

