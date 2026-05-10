// Module-specific file: contains business rules for this module only.
// Do not move this logic into generic/shared files.

import { modules } from "../../config/modules";
import { rowValueForField } from "../gridRowValue";
import { getYmdISTFromInstant } from "../istDateTime";
import { normalizeNciCaseStatusLabel } from "./newCaseInwardCaseStatus";
import { escapeSqlTableId, escapeSqlTableIdForModuleConfig } from "../sqlModuleTable";
import { toYyyyMmDdForSqlDateField } from "../sqlDateFieldValue";

const RETURN_CASE_SEQUENCE_MODULE_KEY = "return_case";

function throwReturnCaseValidation(message) {
  throw Object.assign(new Error(message), { code: "RETURN_CASE_VALIDATION_FAILED" });
}

function normalizeAllowFlag(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/**
 * If return-case date falls in a Financial Year with Freeze Transactions = Yes, block the save.
 * Same rule as new_case_inward, transfer_case, and public_notice.
 */
async function assertReturnCaseDateNotInFrozenFinancialYear(conn, bizDate) {
  const ymd = toYyyyMmDdForSqlDateField(bizDate);
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

  throwReturnCaseValidation(
    "Transactions are locked for the selected financial year. Please contact the administrator."
  );
}

function asPositiveInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function coerceSelectTinyInt(value) {
  if (value === true) return 1;
  if (value === false) return 0;
  const n = Number(value);
  if (n === 1) return 1;
  if (n === 0) return 0;
  return null;
}

function detailRowHasMeaning(row) {
  const reasonText = String(row?.returnReason ?? "").trim();
  if (reasonText) return true;
  return coerceSelectTinyInt(row?.select) === 1;
}

export async function validateReturnCaseBeforeWrite(conn, { parentData, childTableRows, parentRecordId = null }) {
  const ymd = toYyyyMmDdForSqlDateField(parentData?.date);
  if (!ymd) {
    throwReturnCaseValidation("Date is required.");
  }
  const todayYmd = getYmdISTFromInstant(new Date());
  if (ymd > todayYmd) {
    throwReturnCaseValidation("Date cannot be greater than today.");
  }

  await assertReturnCaseDateNotInFrozenFinancialYear(conn, parentData?.date);

  const caseId = asPositiveInt(parentData?.caseNo);
  if (!caseId) {
    throwReturnCaseValidation("Case No is required.");
  }

  const rows = Array.isArray(childTableRows?.return_case_details) ? childTableRows.return_case_details : [];

  const checkedRows = rows.filter((row) => coerceSelectTinyInt(row?.select) === 1);
  if (!checkedRows.length) {
    throwReturnCaseValidation("Select at least one Return Case Details row.");
  }

  for (const row of checkedRows) {
    if (!detailRowHasMeaning(row)) continue;
    const reasonText = String(row?.returnReason ?? "").trim();
    if (!reasonText) {
      throwReturnCaseValidation("Return Reason is required for each filled Return Case Details row.");
    }
    if (row?.select !== undefined && row?.select !== null && String(row.select).trim() !== "") {
      const sel = coerceSelectTinyInt(row.select);
      if (sel === null) {
        throwReturnCaseValidation("Select must be 0 or 1 for each Return Case Details row.");
      }
    }
  }

  const nciTable = escapeSqlTableIdForModuleConfig(modules.new_case_inward);
  const lvmTable = escapeSqlTableIdForModuleConfig(modules.lookup_value_master);

  const [caseRows] = await conn.query(
    `SELECT lv.lookupValue AS caseStatusLabel
     FROM ${nciTable} n
     LEFT JOIN ${lvmTable} lv ON lv.id = n.caseStatus
     WHERE n.id = ?
     LIMIT 1`,
    [caseId]
  );
  if (!caseRows?.length) {
    throwReturnCaseValidation("Selected Case No was not found.");
  }
  const statusRaw = rowValueForField(caseRows[0], "caseStatusLabel");
  if (statusRaw == null || String(statusRaw).trim() === "") {
    throwReturnCaseValidation("Selected Case No has no Case Status; cannot use for Return Case.");
  }
  const statusNorm = normalizeNciCaseStatusLabel(statusRaw);
  if (statusNorm !== normalizeNciCaseStatusLabel("Returned")) {
    throwReturnCaseValidation('Only cases in "Returned" status can be selected for Return Case.');
  }

  const rcTable = escapeSqlTableIdForModuleConfig(modules.return_case);
  const dupParams = [caseId];
  let dupSql = `SELECT id FROM ${rcTable} WHERE caseNo = ?`;
  const pr = asPositiveInt(parentRecordId);
  if (pr) {
    dupSql += ` AND id <> ?`;
    dupParams.push(pr);
  }
  dupSql += ` LIMIT 1`;
  const [dupRows] = await conn.query(dupSql, dupParams);
  if (dupRows?.length) {
    throwReturnCaseValidation("This Case No is already used on another Return Case record.");
  }
}

export async function applyReturnCaseBeforeWrite(conn, { oldRow, merged, childTableRows, parentRecordId = null }) {
  await validateReturnCaseBeforeWrite(conn, {
    parentData: oldRow ? { ...oldRow, ...merged } : merged,
    childTableRows,
    parentRecordId
  });
}

async function resolveYearCodeByDate(conn, bizDate) {
  const ymd = toYyyyMmDdForSqlDateField(bizDate);
  if (!ymd) {
    throwReturnCaseValidation("Date is required to generate Ref No.");
  }
  const fyTable = escapeSqlTableIdForModuleConfig(modules.financial_year_master);
  const [rows] = await conn.query(
    `SELECT yearCode FROM ${fyTable} WHERE ? BETWEEN startDate AND endDate LIMIT 1`,
    [ymd]
  );
  const yearCode = String(rowValueForField(rows?.[0] || {}, "yearCode") ?? "").trim();
  if (!yearCode) {
    throwReturnCaseValidation("No Financial Year found for selected Date.");
  }
  return yearCode;
}

export async function assignReturnCaseRefNo(conn, recordId) {
  const rcTable = escapeSqlTableIdForModuleConfig(modules.return_case);
  const seqTable = escapeSqlTableId("module_number_sequence");
  const [rows] = await conn.query(`SELECT id, date FROM ${rcTable} WHERE id = ? LIMIT 1`, [recordId]);
  if (!rows?.length) {
    throwReturnCaseValidation("Return Case row was not found while generating Ref No.");
  }

  const yearCode = await resolveYearCodeByDate(conn, rowValueForField(rows[0], "date"));
  const sequencePrefix = `RETURN/${yearCode}`;

  await conn.query(
    `INSERT INTO ${seqTable} (module, prefix, lastNumber) VALUES (?, ?, 0)
     ON DUPLICATE KEY UPDATE lastNumber = lastNumber`,
    [RETURN_CASE_SEQUENCE_MODULE_KEY, sequencePrefix]
  );

  const [seqRows] = await conn.query(`SELECT lastNumber FROM ${seqTable} WHERE module = ? AND prefix = ? FOR UPDATE`, [
    RETURN_CASE_SEQUENCE_MODULE_KEY,
    sequencePrefix
  ]);
  if (!seqRows?.length) {
    throwReturnCaseValidation("Return Case sequence row missing.");
  }

  const last = Number(rowValueForField(seqRows[0], "lastNumber"));
  const next = Number.isFinite(last) ? last + 1 : 1;
  const refNo = `RETURN/${yearCode}/${String(next).padStart(5, "0")}`;

  await conn.query(`UPDATE ${seqTable} SET lastNumber = ? WHERE module = ? AND prefix = ?`, [
    next,
    RETURN_CASE_SEQUENCE_MODULE_KEY,
    sequencePrefix
  ]);
  await conn.query(`UPDATE ${rcTable} SET refNo = ? WHERE id = ? AND (refNo IS NULL OR TRIM(refNo) = '')`, [refNo, recordId]);
}
