/**
 * =============================================================================
 * INVOICE CASE SNAPSHOT — Read-only NCI / invoice rows for entry forms & PDFs
 * =============================================================================
 * Invoice screens need a case summary without applying normal CRUD row-scope
 * filters. These loaders enrich lookup labels and optionally child grids for
 * snapshot APIs and PDF print.
 * =============================================================================
 */

import { modules } from "../../config/modules";
import { loadChildTableRowsForParent } from "../childTablesLoad";
import { enrichLookupDisplayRows } from "../crudLookupEnrich";
import pool from "../db";
import { hasModulePermission } from "../rbac";
import { escapeSqlTableIdForModuleConfig } from "../sqlModuleTable";
import {
  canAccessAnyInvoiceModule,
  INVOICE_MODULE_KEYS_WITH_NPA_AUTO_FILL
} from "./invoiceNpaCurrentAc";
import { INVOICES_RECEIVED_MODULE_KEY } from "./invoicesReceived";

/** Invoice modules that show the shared case-snapshot panel. */
export const INVOICE_MODULE_KEYS_WITH_CASE_SNAPSHOT = INVOICE_MODULE_KEYS_WITH_NPA_AUTO_FILL;

/** Invoice modules whose own row can be loaded for the Invoices Received snapshot. */
export const INVOICE_ROW_SNAPSHOT_MODULE_KEYS = [...INVOICE_MODULE_KEYS_WITH_NPA_AUTO_FILL];

/**
 * Invoice / case snapshot APIs may load linked rows without CRUD row scope.
 *
 * @param {object | null | undefined} user
 * @returns {Promise<boolean>}
 */
export async function canAccessInvoiceLinkedSnapshot(user) {
  if (await canAccessAnyInvoiceModule(user)) return true;
  const [canView, canCreate, canEdit] = await Promise.all([
    hasModulePermission(user, INVOICES_RECEIVED_MODULE_KEY, "view"),
    hasModulePermission(user, INVOICES_RECEIVED_MODULE_KEY, "create"),
    hasModulePermission(user, INVOICES_RECEIVED_MODULE_KEY, "edit")
  ]);
  return canView || canCreate || canEdit;
}

/**
 * Load enriched New Case Inward parent row for invoice case snapshot (no unit scope).
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {number|string} caseId
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function loadInvoiceCaseSnapshotByCaseId(conn, caseId) {
  const id = Number(caseId);
  if (!Number.isFinite(id) || id <= 0) return null;

  const mod = modules.new_case_inward;
  if (!mod?.table) return null;

  const tbl = escapeSqlTableIdForModuleConfig(mod);
  const [rows] = await conn.query(`SELECT * FROM ${tbl} WHERE id = ? LIMIT 1`, [id]);
  if (!rows?.length) return null;

  const row = { ...rows[0] };
  await enrichLookupDisplayRows(mod, [row]);
  return row;
}

/**
 * Load an invoice row (recovery/SARFAESI/vehicle) for the Invoices Received snapshot modal.
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {string} moduleKey
 * @param {number|string} invoiceId
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function loadInvoiceRowForSnapshotById(conn, moduleKey, invoiceId) {
  if (!INVOICE_ROW_SNAPSHOT_MODULE_KEYS.includes(moduleKey)) return null;

  const id = Number(invoiceId);
  if (!Number.isFinite(id) || id <= 0) return null;

  const mod = modules[moduleKey];
  if (!mod?.table) return null;

  const tbl = escapeSqlTableIdForModuleConfig(mod);
  const [rows] = await conn.query(`SELECT * FROM ${tbl} WHERE id = ? LIMIT 1`, [id]);
  if (!rows?.length) return null;

  const row = { ...rows[0] };
  await enrichLookupDisplayRows(mod, [row]);
  return row;
}

/**
 * NCI parent (+ optional child grids) for invoice PDF print — no unit row scope.
 *
 * @param {number|string} caseId
 * @param {{ childKeys?: string[] }} [options]
 * @returns {Promise<{ data: Record<string, unknown>, childTableRows: Record<string, unknown[]> } | null>}
 */
export async function loadInvoiceLinkedCaseByCaseId(caseId, options = {}) {
  const id = Number(caseId);
  if (!Number.isFinite(id) || id <= 0) return null;

  const childKeys = Array.isArray(options.childKeys) ? options.childKeys : [];
  const mod = modules.new_case_inward;
  if (!mod?.table) return null;

  const conn = await pool.getConnection();
  try {
    const data = await loadInvoiceCaseSnapshotByCaseId(conn, id);
    if (!data) return null;

    const childTableRows = {};
    if (childKeys.length > 0) {
      const allChildren = (await loadChildTableRowsForParent(mod, id)) || {};
      for (const key of childKeys) {
        childTableRows[key] = Array.isArray(allChildren[key]) ? allChildren[key] : [];
        const ct = (mod.childTables || []).find((c) => (c.key || c.table) === key);
        if (ct?.fields?.length && childTableRows[key].length > 0) {
          await enrichLookupDisplayRows({ fields: ct.fields }, childTableRows[key]);
        }
      }
    }

    return { data, childTableRows };
  } finally {
    conn.release();
  }
}
