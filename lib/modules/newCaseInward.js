/**
 * =============================================================================
 * NEW CASE INWARD — all server-side module-specific logic lives in THIS file only.
 * =============================================================================
 * Do not add sibling files like newCaseInwardXxx.js; extend here (helpers + exports).
 *
 * Generic CRUD calls into this module via lib/moduleAfterCreate.js (after INSERT).
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
import { rowValueForField } from "../gridRowValue";
import { escapeSqlTableId, escapeSqlTableIdForModuleConfig } from "../sqlModuleTable";

const SEQUENCE_MODULE_KEY = "new_case_inward";

/** lookup_value_master.id (Loan Category) → Case No segment. Edit ids to match your DB. */
const LOAN_CATEGORY_CASE_NO_CODES = {
  3: "CF",
  4: "SRF",
  9: "VL",
  10: "AL"
};

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
