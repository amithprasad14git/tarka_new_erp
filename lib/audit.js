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
 * =============================================================================
 */
import pool from "./db";
import { escapeSqlTableId } from "./sqlModuleTable";

/**
 * Inserts a single audit trail row. Safe to call after successful DB commit path in services.
 *
 * Parameters (all optional except meaning):
 * - userId — who performed the action.
 * - moduleName — which screen/table key (e.g. employee_master).
 * - action — short verb: create | update | delete.
 * - recordId — primary key of the affected row.
 * - oldData — before snapshot (object → stored as JSON string), null on create.
 * - newData — after snapshot, null on delete.
 *
 * Also duplicates user/time into standard audit columns on the audit_logs row itself
 * so the audit table is self-describing.
 */
export async function writeAuditLog({
  userId,
  moduleName,
  action,
  recordId = null,
  oldData = null,
  newData = null
}) {
  // `oldData` / `newData` are JSON-stringified to keep a stable snapshot.
  // For delete actions, `newData` is left as null.
  const now = new Date();
  const uid = userId ?? null;
  const at = escapeSqlTableId("audit_logs");
  await pool.query(
    `INSERT INTO ${at} (user_id, module, action, record_id, old_data, new_data,
                            createdBy, createdDate, modifiedBy, modifiedDate)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uid,
      moduleName ?? null,
      action ?? null,
      recordId ?? null,
      oldData ? JSON.stringify(oldData) : null,
      newData ? JSON.stringify(newData) : null,
      uid,
      now,
      uid,
      now
    ]
  );
}
