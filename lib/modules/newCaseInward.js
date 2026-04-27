/**
 * =============================================================================
 * NEW CASE INWARD — all server-side module-specific logic lives in THIS file only.
 * =============================================================================
 * Do not add sibling files under `lib/modules/` except shared data: `lib/newCaseInwardCaseStatus.js` (case status labels).
 *
 * Generic CRUD calls into this module via lib/moduleAfterCreate.js (after INSERT).
 *
 * `validateNewCaseInwardBeforeWrite` applies **only** to `new_case_inward` (see crud.service.js).
 * It is not shared generic CRUD validation; other modules use only `validateCrudPayloadForWrite`.
 *
 * Case Status label lists: `lib/newCaseInwardCaseStatus.js` (imported below).
 *
 * Case No (plain language):
 * 1) Map Loan Category lookup id → short code (LOAN_CATEGORY_CASE_NO_CODES below).
 * 2) Follow Branch → RBO/RO → HO/ZO → Bank for caseNoPrefix.
 * 3) Sequence key in module_number_sequence: `{caseNoPrefix}/{categoryCode}` (auto-insert row if missing).
 * 4) Set caseNo to `{caseNoPrefix}/{categoryCode}/{nnnnn}`.
 *
 * Errors: broken hierarchy, empty bank prefix, missing/unknown loan category, sequence edge cases.
 * =============================================================================
 */
import { modules } from "../../config/modules";
import {
  CASE_STATUS_REQUIRES_RECOVERY_SET,
  FINAL_CASE_STATUS_SET,
  REOPEN_ALLOWED_FINAL_CASE_STATUS_SET,
  normalizeNciCaseStatusLabel as normalizeLookupText
} from "../newCaseInwardCaseStatus";
import { rowValueForField } from "../gridRowValue";
import { getYmdISTFromInstant, subtractCalendarDaysFromYmd } from "../istDateTime";
import { toYyyyMmDdForSqlDateField } from "../sqlDateFieldValue";
import { escapeSqlTableId, escapeSqlTableIdForModuleConfig } from "../sqlModuleTable";

const SEQUENCE_MODULE_KEY = "new_case_inward";

/** lookup_value_master.id (Loan Category) → Case No segment. Edit ids to match your DB. */
const LOAN_CATEGORY_CASE_NO_CODES = {
  3: "CF",
  4: "SRF",
  9: "VL",
  10: "AL"
};

const NCI_TXN_CTRL_FIELD_ENTRUSTMENT_DATE = "Entrustment Date";
const NCI_TXN_CTRL_FIELD_AMOUNT_RECOVERED = "Amount Recovered";
const NCI_TXN_CTRL_FIELD_CASE_STATUS_UPDATE = "Case Status Update";

function normalizeLoanAccountNo(v) {
  return String(v ?? "").trim();
}

/** True when LoV has a real FK (non-empty, positive numeric id). */
function hasCaseStatusLookupSelected(raw) {
  if (raw == null) return false;
  const s = String(raw).trim();
  if (s === "") return false;
  const n = Number(s);
  return Number.isFinite(n) && n > 0;
}

function assertLoanAccountNoNumeric(loanAccountNo) {
  const value = normalizeLoanAccountNo(loanAccountNo);
  if (!value) return;
  if (!/^\d+$/.test(value)) {
    throw Object.assign(
      new Error("Loan Account No must contain only digits (0-9), with no spaces or special characters."),
      { code: "NCI_VALIDATION_FAILED" }
    );
  }
}

async function getCaseStatusTextById(conn, caseStatusId) {
  const id = Number(caseStatusId);
  if (!Number.isFinite(id)) return "";
  const lvm = escapeSqlTableIdForModuleConfig(modules.lookup_value_master);
  const [rows] = await conn.query(`SELECT lookupValue FROM ${lvm} WHERE id = ? LIMIT 1`, [id]);
  return normalizeLookupText(rowValueForField(rows?.[0] || {}, "lookupValue"));
}

/**
 * Single calendar day as YYYY-MM-DD for comparisons (aligned with view grid + date inputs).
 */
function normalizeYmd(dateLike) {
  if (dateLike == null || dateLike === "") return "";
  const s = String(dateLike).trim();
  const m = s.match(/^(\d{2})-(\d{2})-(\d{4})/);
  if (m) {
    const day = Number(m[1]);
    const mo = Number(m[2]);
    const y = Number(m[3]);
    if (Number.isFinite(day) && Number.isFinite(mo) && Number.isFinite(y)) {
      return `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return toYyyyMmDdForSqlDateField(dateLike);
}

function isFutureYmd(dateLike) {
  const ymd = normalizeYmd(dateLike);
  if (!ymd) return false;
  const todayIst = getYmdISTFromInstant(new Date());
  if (!todayIst) return false;
  return ymd > todayIst;
}

function toNonNegativeDays(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function normalizeAllowFlag(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

async function assertCaseStatusDateNotInFrozenFinancialYear(conn, caseStatusUpdatedDate) {
  const ymd = normalizeYmd(caseStatusUpdatedDate);
  if (!ymd) return;

  // Plain-language rule:
  // If "Case Status Updated Date" falls inside a Financial Year whose
  // "Freeze Transactions" is Yes, this save must stop.
  const fy = modules.financial_year_master;
  if (!fy?.table) return;
  const t = escapeSqlTableIdForModuleConfig(fy);
  const [rows] = await conn.query(
    `
    SELECT freezeTransactions
    FROM ${t}
    WHERE ? BETWEEN startDate AND endDate
    `,
    [ymd]
  );

  const hasFrozenYear = Array.isArray(rows)
    ? rows.some((r) => normalizeAllowFlag(rowValueForField(r, "freezeTransactions")) === "yes")
    : false;
  if (!hasFrozenYear) return;

  throw Object.assign(
    new Error("Transactions are locked for the selected financial year. Please contact the administrator."),
    { code: "NCI_VALIDATION_FAILED" }
  );
}

async function getNewCaseInwardTransactionControlByField(conn) {
  const mod = modules.new_case_inward_transaction_control;
  if (!mod?.table) return new Map();
  const t = escapeSqlTableIdForModuleConfig(mod);
  let rows = [];
  try {
    const [qRows] = await conn.query(`SELECT field_name, allow_flag, days, is_active FROM ${t}`);
    rows = qRows || [];
  } catch {
    // If control table is not created yet, keep NCI save path non-blocking.
    return new Map();
  }
  const out = new Map();
  for (const r of rows || []) {
    const fieldName = String(rowValueForField(r, "field_name") ?? "").trim();
    if (!fieldName) continue;
    const activeRaw = rowValueForField(r, "is_active");
    const active = activeRaw == null ? true : Number(activeRaw) !== 0;
    if (!active) continue;
    out.set(fieldName, {
      allowFlag: String(rowValueForField(r, "allow_flag") ?? "Yes").trim(),
      days: toNonNegativeDays(rowValueForField(r, "days"))
    });
  }
  return out;
}

async function getExistingNewCaseInwardDateSnapshot(conn, parentId) {
  const pid = Number(parentId);
  if (!Number.isFinite(pid) || pid <= 0) return null;
  const nci = escapeSqlTableIdForModuleConfig(modules.new_case_inward);
  const child = escapeSqlTableId("new_case_inward_amount_recovered");
  const [parentRows] = await conn.query(
    `SELECT entrustmentDate, caseStatusUpdatedDate FROM ${nci} WHERE id = ? LIMIT 1`,
    [pid]
  );
  const entrustmentDate = normalizeYmd(rowValueForField(parentRows?.[0] || {}, "entrustmentDate"));
  const caseStatusUpdatedDate = normalizeYmd(rowValueForField(parentRows?.[0] || {}, "caseStatusUpdatedDate"));
  const [childRows] = await conn.query(
    `SELECT id, recoveredDate FROM ${child} WHERE caseInwardId = ?`,
    [pid]
  );
  const recoveredDateById = new Map();
  for (const r of childRows || []) {
    const id = Number(rowValueForField(r, "id"));
    if (!Number.isFinite(id)) continue;
    recoveredDateById.set(id, normalizeYmd(rowValueForField(r, "recoveredDate")));
  }
  return { entrustmentDate, caseStatusUpdatedDate, recoveredDateById };
}

function assertBackdateAllowedByControl({ dateValue, control, fieldLabel }) {
  if (dateValue == null || dateValue === "") return;
  const ymd = normalizeYmd(dateValue);
  if (!ymd) return;
  const allow = normalizeAllowFlag(control?.allowFlag || "Yes");
  if (allow === "yes") return;
  const days = toNonNegativeDays(control?.days);
  const minYmd = subtractCalendarDaysFromYmd(getYmdISTFromInstant(new Date()), days);
  if (!minYmd) return;
  if (ymd < minYmd) {
    throw Object.assign(
      new Error(`${fieldLabel} cannot be older than ${days} days as per Transaction Control.`),
      { code: "NCI_VALIDATION_FAILED" }
    );
  }
}

function recoveredTotalFromPayloadRows(childTableRows) {
  const rows = Array.isArray(childTableRows?.amount_recovered) ? childTableRows.amount_recovered : [];
  return rows.reduce((sum, row) => {
    const n = Number(row?.recoveredAmount);
    return Number.isFinite(n) ? sum + n : sum;
  }, 0);
}

/**
 * Resolves bank context from a Branch id for New Case Inward rules.
 * Returns null when the hierarchy cannot be resolved.
 */
export async function resolveNewCaseInwardBankRuleByBranch(conn, branchId) {
  const bid = Number(branchId);
  if (!Number.isFinite(bid)) return null;

  const br = escapeSqlTableIdForModuleConfig(modules.branch_master);
  const rbo = escapeSqlTableIdForModuleConfig(modules.rbo_master);
  const hz = escapeSqlTableIdForModuleConfig(modules.ho_zo_master);
  const bm = escapeSqlTableIdForModuleConfig(modules.bank_master);
  const [rows] = await conn.query(
    `
    SELECT
      bm.id AS bankId,
      bm.bankName AS bankName,
      bm.loanAccountNoLength AS loanAccountNoLength
    FROM ${br} br
    INNER JOIN ${rbo} rbo ON rbo.id = br.rbo_ro
    INNER JOIN ${hz} hz ON hz.id = rbo.ho_zo
    INNER JOIN ${bm} bm ON bm.id = hz.bank
    WHERE br.id = ?
    LIMIT 1
    `,
    [bid]
  );

  if (!Array.isArray(rows) || !rows.length) return null;
  const row = rows[0] || {};
  const rule = Number(rowValueForField(row, "loanAccountNoLength"));
  return {
    bankId: Number(rowValueForField(row, "bankId")) || null,
    bankName: String(rowValueForField(row, "bankName") ?? "").trim(),
    loanAccountNoLength: Number.isFinite(rule) && rule > 0 ? rule : null
  };
}

/**
 * Returns true if the given caseStatus lookup id belongs to a final-stage status.
 */
export async function isNewCaseInwardFinalStatusById(conn, caseStatusId) {
  const text = await getCaseStatusTextById(conn, caseStatusId);
  return FINAL_CASE_STATUS_SET.has(text);
}

/**
 * For role-2 list/view responses: mark final-stage rows as non-editable.
 */
export async function applyRole2FinalStageEditLock(conn, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  const ids = [...new Set(rows.map((r) => Number(r?.caseStatus)).filter((v) => Number.isFinite(v)))];
  if (!ids.length) return;

  const lvm = escapeSqlTableIdForModuleConfig(modules.lookup_value_master);
  const placeholders = ids.map(() => "?").join(", ");
  const [lookupRows] = await conn.query(
    `SELECT id, lookupValue FROM ${lvm} WHERE id IN (${placeholders})`,
    ids
  );
  const statusById = new Map(
    (lookupRows || []).map((r) => [Number(rowValueForField(r, "id")), normalizeLookupText(rowValueForField(r, "lookupValue"))])
  );

  for (const row of rows) {
    const sid = Number(row?.caseStatus);
    if (!Number.isFinite(sid)) continue; // blank/null caseStatus treated as active/editable
    const statusText = statusById.get(sid) || "";
    if (FINAL_CASE_STATUS_SET.has(statusText)) {
      row._canEdit = false;
    }
  }
}

async function assertNoActiveDuplicateLoanAccount(conn, loanAccountNo, currentId = null) {
  const normalized = normalizeLoanAccountNo(loanAccountNo);
  if (!normalized) return;
  const nci = escapeSqlTableIdForModuleConfig(modules.new_case_inward);
  const lvm = escapeSqlTableIdForModuleConfig(modules.lookup_value_master);

  const params = [normalized];
  let selfExcludeSql = "";
  const curr = Number(currentId);
  if (Number.isFinite(curr)) {
    selfExcludeSql = "AND nci.id <> ?";
    params.push(curr);
  }

  const [rows] = await conn.query(
    `
    SELECT
      nci.id,
      nci.caseNo,
      nci.caseStatus,
      lvm.lookupValue AS caseStatusLabel
    FROM ${nci} nci
    LEFT JOIN ${lvm} lvm ON lvm.id = nci.caseStatus
    WHERE TRIM(COALESCE(nci.loanAccountNo, '')) = ?
      ${selfExcludeSql}
    ORDER BY nci.id DESC
    `,
    params
  );

  if (!Array.isArray(rows) || rows.length === 0) return;
  const blocking = rows.find((r) => {
    const statusText = normalizeLookupText(rowValueForField(r, "caseStatusLabel"));
    if (!statusText) return true; // blank/null caseStatus => active
    return !REOPEN_ALLOWED_FINAL_CASE_STATUS_SET.has(statusText);
  });
  if (!blocking) return;

  const oldCaseNo = String(rowValueForField(blocking, "caseNo") || `#${rowValueForField(blocking, "id") || ""}`).trim();
  throw Object.assign(
    new Error(`This case is already available (Case No: ${oldCaseNo}). Duplicate Loan Account No is not allowed.`),
    { code: "NCI_VALIDATION_FAILED" }
  );
}

function getLoanCategoryCaseNoCode(loanCategoryId) {
  const map = LOAN_CATEGORY_CASE_NO_CODES;
  const keys = Object.keys(map).filter((k) => Object.prototype.hasOwnProperty.call(map, k));
  if (!keys.length) {
    const err = new Error(
      "Case No: add Loan Category lookup ids to LOAN_CATEGORY_CASE_NO_CODES in lib/modules/newCaseInward.js."
    );
    err.code = "LOAN_CATEGORY_CASE_NO_MAP_MISSING";
    throw err;
  }
  const id = Number(loanCategoryId);
  if (!Number.isFinite(id)) {
    const err = new Error("Case No: Loan Category is required.");
    err.code = "LOAN_CATEGORY_MISSING";
    throw err;
  }
  const code = map[id] ?? map[String(id)];
  if (code == null || String(code).trim() === "") {
    const err = new Error(
      `Case No: Loan Category id ${id} is not mapped. Add it to LOAN_CATEGORY_CASE_NO_CODES in lib/modules/newCaseInward.js (CF / SRF / VL / AL only).`
    );
    err.code = "LOAN_CATEGORY_CASE_NO_UNKNOWN";
    throw err;
  }
  return String(code).trim();
}

/**
 * @param {import("mysql2/promise").PoolConnection} conn Open DB connection; must be inside a transaction.
 * @param {number} recordId Primary key of the row just inserted into new_case_inward.
 */
export async function assignNewCaseInwardCaseNo(conn, recordId) {
  const nci = escapeSqlTableIdForModuleConfig(modules.new_case_inward);
  const br = escapeSqlTableIdForModuleConfig(modules.branch_master);
  const rbo = escapeSqlTableIdForModuleConfig(modules.rbo_master);
  const hz = escapeSqlTableIdForModuleConfig(modules.ho_zo_master);
  const bm = escapeSqlTableIdForModuleConfig(modules.bank_master);
  const seqTable = escapeSqlTableId("module_number_sequence");

  const [nciRows] = await conn.query(
    `SELECT loanCategory FROM ${nci} WHERE id = ? LIMIT 1`,
    [recordId]
  );
  const loanCategoryRaw = nciRows?.[0] ? rowValueForField(nciRows[0], "loanCategory") : null;
  if (loanCategoryRaw == null || loanCategoryRaw === "") {
    const err = new Error("Case No: Loan Category is required.");
    err.code = "LOAN_CATEGORY_MISSING";
    throw err;
  }

  const categoryCode = getLoanCategoryCaseNoCode(loanCategoryRaw);

  const [chainRows] = await conn.query(
    `
    SELECT bm.caseNoPrefix AS caseNoPrefix
    FROM ${nci} nci
    INNER JOIN ${br} br ON br.id = nci.branch
    INNER JOIN ${rbo} rbo ON rbo.id = br.rbo_ro
    INNER JOIN ${hz} hz ON hz.id = rbo.ho_zo
    INNER JOIN ${bm} bm ON bm.id = hz.bank
    WHERE nci.id = ?
    LIMIT 1
    `,
    [recordId]
  );

  if (!Array.isArray(chainRows) || !chainRows.length) {
    const err = new Error(
      "Could not resolve Case No prefix: check Branch and hierarchy (Branch → RBO/RO → HO/ZO → Bank) for this record."
    );
    err.code = "CASE_NO_PREFIX_UNRESOLVED";
    throw err;
  }

  const bankPrefix = String(rowValueForField(chainRows[0], "caseNoPrefix") ?? "").trim();

  if (!bankPrefix) {
    const err = new Error(
      'Case No prefix is empty for this bank. Set "Case No Prefix" on Bank Master for the bank linked to this branch.'
    );
    err.code = "CASE_NO_PREFIX_EMPTY";
    throw err;
  }

  const sequencePrefix = `${bankPrefix}/${categoryCode}`;

  await conn.query(
    `INSERT INTO ${seqTable} (module, prefix, lastNumber) VALUES (?, ?, 0)
     ON DUPLICATE KEY UPDATE lastNumber = lastNumber`,
    [SEQUENCE_MODULE_KEY, sequencePrefix]
  );

  const [seqRows] = await conn.query(
    `SELECT lastNumber FROM ${seqTable} WHERE module = ? AND prefix = ? FOR UPDATE`,
    [SEQUENCE_MODULE_KEY, sequencePrefix]
  );

  if (!Array.isArray(seqRows) || !seqRows.length) {
    const err = new Error("Case No: sequence row missing after insert; retry or contact support.");
    err.code = "CASE_NO_SEQUENCE_ROW";
    throw err;
  }

  const last = Number(rowValueForField(seqRows[0], "lastNumber"));
  const next = Number.isFinite(last) ? last + 1 : 1;
  const caseNo = `${bankPrefix}/${categoryCode}/${String(next).padStart(5, "0")}`;

  await conn.query(`UPDATE ${seqTable} SET lastNumber = ? WHERE module = ? AND prefix = ?`, [
    next,
    SEQUENCE_MODULE_KEY,
    sequencePrefix
  ]);

  const nciTable = escapeSqlTableIdForModuleConfig(modules.new_case_inward);
  await conn.query(
    `UPDATE ${nciTable} SET caseNo = ? WHERE id = ? AND (caseNo IS NULL OR TRIM(caseNo) = '')`,
    [caseNo, recordId]
  );
}

/**
 * New Case Inward domain rules before create/update.
 * Throws Error(code: NCI_VALIDATION_FAILED) for user-fixable validation issues.
 */
export async function validateNewCaseInwardBeforeWrite(
  conn,
  { parentData, childTableRows, parentId = null, skipDateValidationsForAdmin = false }
) {
  assertLoanAccountNoNumeric(parentData?.loanAccountNo);
  await assertNoActiveDuplicateLoanAccount(conn, parentData?.loanAccountNo, parentId);

  // Future dates are blocked for all roles (including admin).
  if (isFutureYmd(parentData?.entrustmentDate)) {
    throw Object.assign(new Error("Entrustment Date cannot be greater than today."), {
      code: "NCI_VALIDATION_FAILED"
    });
  }
  if (isFutureYmd(parentData?.npaDate)) {
    throw Object.assign(new Error("NPA Date cannot be greater than today."), {
      code: "NCI_VALIDATION_FAILED"
    });
  }
  if (isFutureYmd(parentData?.caseStatusUpdatedDate)) {
    throw Object.assign(new Error("Case Status Updated Date cannot be greater than today."), {
      code: "NCI_VALIDATION_FAILED"
    });
  }
  const txnControlByField = await getNewCaseInwardTransactionControlByField(conn);
  const existingSnapshot = await getExistingNewCaseInwardDateSnapshot(conn, parentId);
  // In edit mode, payload may omit caseStatusUpdatedDate. We still enforce FY lock
  // using the already-saved row date so users cannot bypass the rule accidentally.
  const effectiveCaseStatusUpdatedDate =
    parentData?.caseStatusUpdatedDate ?? existingSnapshot?.caseStatusUpdatedDate ?? null;
  if (!skipDateValidationsForAdmin) {
    await assertCaseStatusDateNotInFrozenFinancialYear(conn, effectiveCaseStatusUpdatedDate);
  }
  const isEditMode = Number.isFinite(Number(parentId)) && Number(parentId) > 0;
  // Entrustment backdate control is create-only (edit path has role-based readonly in UI).
  if (!skipDateValidationsForAdmin && !isEditMode) {
    assertBackdateAllowedByControl({
      dateValue: parentData?.entrustmentDate,
      control: txnControlByField.get(NCI_TXN_CTRL_FIELD_ENTRUSTMENT_DATE),
      fieldLabel: "Entrustment Date"
    });
  }

  const incomingCaseStatusUpdatedYmd = normalizeYmd(parentData?.caseStatusUpdatedDate);
  const existingCaseStatusUpdatedYmd = existingSnapshot
    ? String(existingSnapshot.caseStatusUpdatedDate || "").trim()
    : "";
  const shouldValidateCaseStatusUpdatedDate =
    !existingSnapshot || incomingCaseStatusUpdatedYmd !== existingCaseStatusUpdatedYmd;
  // Case-status updated date participates in Transaction Control under field_name="Case Status Update".
  if (!skipDateValidationsForAdmin && shouldValidateCaseStatusUpdatedDate) {
    assertBackdateAllowedByControl({
      dateValue: parentData?.caseStatusUpdatedDate,
      control: txnControlByField.get(NCI_TXN_CTRL_FIELD_CASE_STATUS_UPDATE),
      fieldLabel: "Case Status Updated Date"
    });
  }

  const recoveredRows = Array.isArray(childTableRows?.amount_recovered) ? childTableRows.amount_recovered : [];
  for (const row of recoveredRows) {
    if (isFutureYmd(row?.recoveredDate)) {
      throw Object.assign(new Error("Amount Recovered Date cannot be greater than today."), {
        code: "NCI_VALIDATION_FAILED"
      });
    }
    const childId = Number(row?.id);
    const incomingRecoveredDate = normalizeYmd(row?.recoveredDate);
    const existingRecoveredDate =
      Number.isFinite(childId) && existingSnapshot?.recoveredDateById?.has(childId)
        ? normalizeYmd(existingSnapshot.recoveredDateById.get(childId))
        : null;
    const shouldValidateRecoveredDate =
      existingRecoveredDate == null || incomingRecoveredDate !== existingRecoveredDate;
    if (!skipDateValidationsForAdmin && shouldValidateRecoveredDate) {
      assertBackdateAllowedByControl({
        dateValue: row?.recoveredDate,
        control: txnControlByField.get(NCI_TXN_CTRL_FIELD_AMOUNT_RECOVERED),
        fieldLabel: "Amount Recovered Date"
      });
    }
  }

  if (
    hasCaseStatusLookupSelected(parentData?.caseStatus) &&
    String(parentData?.caseStatusRemarks ?? "").trim() === ""
  ) {
    throw Object.assign(
      new Error("Case Status Remarks is required when Case Status is selected."),
      { code: "NCI_VALIDATION_FAILED" }
    );
  }

  const bankRule = await resolveNewCaseInwardBankRuleByBranch(conn, parentData?.branch);
  const configuredLoanNoLength = Number(bankRule?.loanAccountNoLength);
  if (Number.isFinite(configuredLoanNoLength) && configuredLoanNoLength > 0) {
    const loanAccountNo = String(parentData?.loanAccountNo ?? "").trim();
    if (loanAccountNo.length !== configuredLoanNoLength) {
      const bankName = String(bankRule?.bankName || "selected bank").trim();
      throw Object.assign(
        new Error(
          `Loan Account No must be exactly ${configuredLoanNoLength} characters for ${bankName}.`
        ),
        { code: "NCI_VALIDATION_FAILED" }
      );
    }
  }

  const caseStatusText = await getCaseStatusTextById(conn, parentData?.caseStatus);
  const requiresRecoveredAmount = CASE_STATUS_REQUIRES_RECOVERY_SET.has(caseStatusText);
  if (!requiresRecoveredAmount) return;

  let totalRecovered = recoveredTotalFromPayloadRows(childTableRows);
  if ((!childTableRows || childTableRows.amount_recovered === undefined) && Number.isFinite(Number(parentId))) {
    const t = escapeSqlTableId("new_case_inward_amount_recovered");
    const [sumRows] = await conn.query(
      `SELECT COALESCE(SUM(recoveredAmount), 0) AS totalRecovered FROM ${t} WHERE caseInwardId = ?`,
      [Number(parentId)]
    );
    totalRecovered = Number(sumRows?.[0]?.totalRecovered || 0);
  }

  if (!(totalRecovered > 0)) {
    throw Object.assign(
      new Error("Selected Case Status requires Amount Recovered to be at least ₹ 1 before saving."),
      { code: "NCI_VALIDATION_FAILED" }
    );
  }
}
