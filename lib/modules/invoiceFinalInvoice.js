/**
 * Final Invoice — cross-cutting rules for recovery_invoice, sarfaesi_invoice, vehicle_invoice only.
 * Syncs `new_case_inward.finalInvoice` from invoice rows and filters Case No pickers.
 */

import { modules } from "../../config/modules";
import { rowValueForField } from "../gridRowValue";
import { escapeSqlTableIdForModuleConfig } from "../sqlModuleTable";

export const FINAL_INVOICE_YES = "Yes";
export const FINAL_INVOICE_NO = "No";

const INVOICE_MODULE_KEYS = ["recovery_invoice", "sarfaesi_invoice", "vehicle_invoice"];

function normalizeFinalInvoiceFlag(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase() === "yes"
    ? FINAL_INVOICE_YES
    : FINAL_INVOICE_NO;
}

/**
 * True if any invoice row for `caseId` has finalInvoice = Yes.
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {number} caseId
 */
export async function anyInvoiceFinalYesForCase(conn, caseId) {
  // True if recovery, SARFAESI, or vehicle invoice marked this case as final.
  const id = Number(caseId);
  if (!Number.isFinite(id) || id <= 0) return false;

  // Any of the three invoice tables may mark the case as "final".
  const unions = INVOICE_MODULE_KEYS.map((key) => {
    const mod = modules[key];
    if (!mod?.table) return null;
    const tbl = escapeSqlTableIdForModuleConfig(mod);
    return `SELECT 1 AS hit FROM ${tbl} WHERE caseNo = ? AND LOWER(TRIM(COALESCE(finalInvoice, ''))) = 'yes'`;
  }).filter(Boolean);

  if (!unions.length) return false;

  const sql = `${unions.join(" UNION ALL ")} LIMIT 1`;
  const params = unions.map(() => id);
  const [rows] = await conn.query(sql, params);
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * Recompute and persist `new_case_inward.finalInvoice` for one case.
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {number} caseId
 */
export async function recomputeNciFinalInvoiceForCase(conn, caseId) {
  const id = Number(caseId);
  if (!Number.isFinite(id) || id <= 0) return;

  const nci = escapeSqlTableIdForModuleConfig(modules.new_case_inward);
  // Denormalized flag on NCI so pickers and reports can filter without joining all invoice tables.
  const flag = (await anyInvoiceFinalYesForCase(conn, id)) ? FINAL_INVOICE_YES : FINAL_INVOICE_NO;
  await conn.query(`UPDATE ${nci} SET finalInvoice = ? WHERE id = ?`, [flag, id]);
}

/**
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {Array<number | string | null | undefined>} caseIds
 */
export async function recomputeNciFinalInvoiceForCaseIds(conn, caseIds) {
  const seen = new Set();
  for (const raw of caseIds || []) {
    const id = Number(raw);
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    await recomputeNciFinalInvoiceForCase(conn, id);
  }
}

/**
 * Case No LoV for all three invoice modules: hide cases marked final on NCI.
 * @param {{ mysql: { escapeId: (name: string) => string }, mainTableRef: string, whereParts: string[], whereValues: unknown[] }} args
 */
export function appendInvoiceCasePickerExcludeFinalYesFilter({
  mysql,
  mainTableRef,
  whereParts,
  whereValues
}) {
  if (!mysql || !mainTableRef || !whereParts || !whereValues) return;
  // New invoices must not be raised on cases already marked final on NCI.
  const col = `${mainTableRef}.${mysql.escapeId("finalInvoice")}`;
  whereParts.push(`(LOWER(TRIM(COALESCE(${col}, ''))) <> 'yes')`);
}

/**
 * After invoice create/update: recompute NCI for affected case(s).
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {string} moduleKey
 * @param {{ insertId?: number, id?: number, oldRow?: object | null, merged?: object | null }} ctx
 */
export async function syncNciFinalInvoiceAfterInvoiceWrite(conn, moduleKey, ctx = {}) {
  if (!INVOICE_MODULE_KEYS.includes(moduleKey)) return;

  const caseIds = [];
  const merged = ctx.merged || {};
  const oldRow = ctx.oldRow || {};

  if (merged.caseNo != null && String(merged.caseNo).trim() !== "") {
    caseIds.push(merged.caseNo);
  }
  if (oldRow.caseNo != null && String(oldRow.caseNo).trim() !== "") {
    caseIds.push(oldRow.caseNo);
  }

  // After save, merged payload may omit caseNo — load it from the invoice row we just wrote.
  if (!caseIds.length && (ctx.insertId != null || ctx.id != null)) {
    const mod = modules[moduleKey];
    if (mod?.table) {
      const tbl = escapeSqlTableIdForModuleConfig(mod);
      const recordId = Number(ctx.insertId ?? ctx.id);
      if (Number.isFinite(recordId) && recordId > 0) {
        const [rows] = await conn.query(`SELECT caseNo FROM ${tbl} WHERE id = ? LIMIT 1`, [recordId]);
        const cn = rowValueForField(rows?.[0] || {}, "caseNo");
        if (cn != null && String(cn).trim() !== "") caseIds.push(cn);
      }
    }
  }

  await recomputeNciFinalInvoiceForCaseIds(conn, caseIds);
}

/**
 * Block create when NCI is already final (picker should prevent; API guard).
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {number} caseIdRaw
 * @param {boolean} isCreate
 */
export async function assertCaseEligibleForNewInvoice(conn, caseIdRaw, isCreate = true) {
  // Editing an existing invoice is allowed; only block brand-new invoice rows.
  if (!isCreate) return;
  const caseId = Number(caseIdRaw);
  if (!Number.isFinite(caseId) || caseId <= 0) return;

  const nci = escapeSqlTableIdForModuleConfig(modules.new_case_inward);
  const [rows] = await conn.query(`SELECT finalInvoice FROM ${nci} WHERE id = ? LIMIT 1`, [caseId]);
  if (!rows?.length) return;

  const flag = String(rowValueForField(rows[0], "finalInvoice") ?? "").trim();
  if (flag.toLowerCase() === "yes") {
    const err = new Error(
      "This case is marked Final Invoice and cannot be used for a new invoice. Edit an existing invoice and set Final Invoice to No first."
    );
    err.code = "INVOICE_CASE_FINAL_BLOCKED";
    throw err;
  }
}

export { normalizeFinalInvoiceFlag };
