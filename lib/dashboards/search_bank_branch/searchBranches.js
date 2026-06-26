// Dashboard — Search Bank & Branch SQL (branch code / name lookup with bank hierarchy).

import pool from "../../db";
import { escapeSqlTableId } from "../../sqlModuleTable";

const RESULT_LIMIT = 50;
const MIN_TERM_LENGTH = 2;

function sqlTableIds() {
  return {
    br: escapeSqlTableId("branch_master"),
    rbo: escapeSqlTableId("rbo_master"),
    hz: escapeSqlTableId("ho_zo_master"),
    bank: escapeSqlTableId("bank_master")
  };
}

/** Branch + bank hierarchy SELECT used by searchBranches. */
function buildSelectSql() {
  const t = sqlTableIds();
  return `
SELECT
  bank.bankName AS bankLabel,
  hz.shortCode AS hoZoLabel,
  rbo.shortCode AS rboRoLabel,
  br.branchCode AS branchCode,
  br.branchName AS branchName,
  br.place AS place,
  br.active AS active
FROM ${t.br} br
INNER JOIN ${t.rbo} rbo ON rbo.id = br.rbo_ro
INNER JOIN ${t.hz} hz ON hz.id = rbo.ho_zo
INNER JOIN ${t.bank} bank ON bank.id = hz.bank
`;
}

/**
 * Search branch_master by code or name (min 2 chars); returns up to 50 rows with bank hierarchy.
 * @param {string} term
 * @returns {{ ok: true, rows: object[], truncated: boolean } | { ok: false, status: number, error: string }}
 */
export async function searchBranches(term) {
  const q = String(term ?? "").trim();
  if (q.length < MIN_TERM_LENGTH) {
    return {
      ok: false,
      status: 400,
      error: `Enter at least ${MIN_TERM_LENGTH} characters to search.`
    };
  }

  const like = `%${q.toLowerCase()}%`;
  const sql = `${buildSelectSql()}
WHERE (
  LOWER(TRIM(br.branchCode)) LIKE ?
  OR LOWER(TRIM(br.branchName)) LIKE ?
)
ORDER BY bank.bankName ASC, br.branchCode ASC
LIMIT ?`;

  const [rawRows] = await pool.query(sql, [like, like, RESULT_LIMIT]);

  const rows = (rawRows || []).map((r) => ({
    bankLabel: r.bankLabel ?? "",
    hoZoLabel: r.hoZoLabel ?? "",
    rboRoLabel: r.rboRoLabel ?? "",
    branchCode: r.branchCode ?? "",
    branchName: r.branchName ?? "",
    place: r.place ?? "",
    active: r.active ?? ""
  }));

  return {
    ok: true,
    rows,
    truncated: rows.length >= RESULT_LIMIT
  };
}

export { MIN_TERM_LENGTH, RESULT_LIMIT };
