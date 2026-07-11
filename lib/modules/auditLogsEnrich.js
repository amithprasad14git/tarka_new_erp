// Module-specific server rules — validations and side effects on save.

/**
 * auditLogsEnrich — business rules when records are created or updated.
 * Form fields and labels: config/modules.js
 */

// Server-only: resolve audit_logs.record_label from business tables for grid display.
import pool from "../db";
import { modules } from "../../config/modules";
import { buildAuditRecordLabel } from "../auditDisplay";
import { rowValueForField } from "../gridRowValue";
import { parseLookupDisplayFieldSpec } from "../lookupLabelField";
import { escapeSqlTableIdForModuleConfig } from "../sqlModuleTable";

import { enrichLookupDisplayRows } from "../crudLookupEnrich";
import { isPlaceholderAuditRecordLabel } from "./auditLogs";

function fieldNameSetForModule(moduleConfig) {
  return new Set((moduleConfig?.fields || []).map((f) => f.name));
}

function primaryDisplayColumn(moduleConfig) {
  // Pick voucher/ref/case field from module config to show as the audit grid “record” label.
  const names = fieldNameSetForModule(moduleConfig);
  const raw = String(moduleConfig?.lookupDisplayField ?? "").trim();
  const parts = parseLookupDisplayFieldSpec(raw, names);
  if (parts.length) return parts[0];
  if (raw && names.has(raw)) return raw;
  const ack = String(moduleConfig?.postCreateAck?.field ?? "").trim();
  if (ack && names.has(ack)) return ack;
  return "";
}

/**
 * Resolve lookup FK ids to display labels on a partial audit snapshot object.
 * @param {string} moduleKey
 * @param {Record<string, unknown> | null | undefined} snapshot
 */
export async function enrichAuditCompareSnapshot(moduleKey, snapshot) {
  if (!snapshot || typeof snapshot !== "object") return snapshot;
  const mod = modules[moduleKey];
  if (!mod) return snapshot;
  const row = { ...snapshot };
  // Turn FK ids into labels so Compare modal matches what staff see on forms.
  await enrichLookupDisplayRows(mod, [row]);
  return row;
}

/**
 * Fill missing or placeholder `record_label` on audit log list rows (batched per module).
 * @param {Array<Record<string, unknown>>} rows
 */
export async function enrichAuditLogRecordLabels(rows) {
  if (!Array.isArray(rows) || !rows.length) return;

  /** @type {Map<string, Array<{ index: number, recordId: number }>>} */
  const pending = new Map();

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const existing = String(rowValueForField(row, "record_label") ?? "").trim();
    // Skip rows that already have a human label (not generic "Record #123").
    if (existing && !isPlaceholderAuditRecordLabel(existing)) continue;

    const moduleKey = String(rowValueForField(row, "module") ?? "").trim();
    const recordId = Number(rowValueForField(row, "record_id"));
    if (!moduleKey || !Number.isFinite(recordId) || recordId <= 0) continue;

    if (!pending.has(moduleKey)) pending.set(moduleKey, []);
    pending.get(moduleKey).push({ index, recordId });
  }

  // One batched query per module (invoice no, ref no, etc.) instead of N+1 lookups.
  for (const [moduleKey, items] of pending) {
    const mod = modules[moduleKey];
    const col = primaryDisplayColumn(mod);
    if (!mod?.table || !col) continue;

    const ids = [...new Set(items.map((x) => x.recordId))];
    if (!ids.length) continue;

    const tbl = escapeSqlTableIdForModuleConfig(mod);
    const colId = col.replace(/`/g, "");
    const placeholders = ids.map(() => "?").join(", ");
    const [bizRows] = await pool.query(
      `SELECT id, \`${colId}\` AS _auditLabelCol FROM ${tbl} WHERE id IN (${placeholders})`,
      ids
    );

    const byId = new Map();
    for (const br of bizRows || []) {
      const id = Number(rowValueForField(br, "id"));
      if (!Number.isFinite(id)) continue;
      byId.set(id, { [col]: rowValueForField(br, "_auditLabelCol") });
    }

    for (const { index, recordId } of items) {
      const biz = byId.get(recordId);
      const label = buildAuditRecordLabel(moduleKey, biz || null, recordId);
      if (label && !isPlaceholderAuditRecordLabel(label)) {
        rows[index].record_label = label;
      }
    }
  }
}


