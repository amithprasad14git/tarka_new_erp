// Shared library helper for reusable application logic.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * =============================================================================
 * AUDIT LOG — A tamper-friendly diary of important data changes
 * =============================================================================
 * Whenever the CRUD service creates, updates, or deletes a business record, it calls
 * writeAuditLog. That appends one row to `audit_logs` with: who did it, which module,
 * what action, which record id, and optional JSON snapshots of old and new data.
 *
 * Think of it like a cashier journal: not for everyday browsing, but for answering
 * “who changed this salary and what was it before?” Deletes still store the old row
 * in old_data; new_data is null because the row no longer exists.
 *
 * This table is read-only in the generic CRUD UI (config/modules.js readOnly).
 *
 * Row stamps use IST wall-clock strings (lib/istDateTime.js).
 *
 * UPDATE snapshots: only columns that changed are stored in old_data / new_data
 * (see pickAuditUpdateSnapshots) to save space. Create/delete snapshots are unchanged.
 * =============================================================================
 */
import pool from "./db";
import { buildAuditRecordLabel } from "./auditDisplay";
import { formatInstantAsMysqlDatetimeIST } from "./istDateTime";
import { escapeSqlTableId } from "./sqlModuleTable";

export { buildAuditRecordLabel } from "./auditDisplay";

function auditValuesEquivalent(a, b) {
  if (Object.is(a, b)) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * For UPDATE audit rows: only keys whose values differ between before and after rows.
 */
export function pickAuditUpdateSnapshots(oldRow, newRow) {
  if (oldRow == null || newRow == null) {
    return { oldData: oldRow ?? null, newData: newRow ?? null };
  }
  if (typeof oldRow !== "object" || typeof newRow !== "object") {
    return { oldData: oldRow, newData: newRow };
  }
  const keys = new Set([...Object.keys(oldRow), ...Object.keys(newRow)]);
  const oldData = {};
  const newData = {};
  for (const k of keys) {
    const ov = Object.prototype.hasOwnProperty.call(oldRow, k) ? oldRow[k] : undefined;
    const nv = Object.prototype.hasOwnProperty.call(newRow, k) ? newRow[k] : undefined;
    if (!auditValuesEquivalent(ov, nv)) {
      oldData[k] = ov;
      newData[k] = nv;
    }
  }
  return { oldData, newData };
}

/**
 * Inserts a single audit trail row. Safe to call after successful DB commit path in services.
 *
 * Parameters (all optional except meaning):
 * - userId — who performed the action.
 * - moduleName — which screen/table key (e.g. employee_master).
 * - action — short verb: create | update | delete.
 * - recordId — primary key of the affected row.
 * - recordLabel — optional human-readable label (e.g. invoice no); auto-built from row when omitted.
 * - oldData — before snapshot (object → stored as JSON string), null on create. For **update**, callers usually pass only changed columns (see pickAuditUpdateSnapshots).
 * - newData — after snapshot, null on delete. For **update**, usually only changed columns.
 *
 * Also duplicates user/time into standard audit columns on the audit_logs row itself
 * so the audit table is self-describing.
 */
export async function writeAuditLog({
  userId,
  moduleName,
  action,
  recordId = null,
  recordLabel = null,
  oldData = null,
  newData = null
}) {
  // `oldData` / `newData` are JSON-stringified to keep a stable snapshot.
  // For delete actions, `newData` is left as null.
  const resolvedLabel =
    recordLabel != null && String(recordLabel).trim() !== ""
      ? String(recordLabel).trim()
      : buildAuditRecordLabel(
          moduleName,
          newData && typeof newData === "object" ? newData : oldData,
          recordId
        );

  const now = formatInstantAsMysqlDatetimeIST();
  const uid = userId ?? null;
  const at = escapeSqlTableId("audit_logs");
  await pool.query(
    `INSERT INTO ${at} (user_id, module, action, record_id, record_label, old_data, new_data,
                            createdBy, createdDate, modifiedBy, modifiedDate)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uid,
      moduleName ?? null,
      action ?? null,
      recordId ?? null,
      resolvedLabel || null,
      oldData ? JSON.stringify(oldData) : null,
      newData ? JSON.stringify(newData) : null,
      uid,
      now,
      uid,
      now
    ]
  );
}
