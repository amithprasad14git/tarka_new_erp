/**
 * =============================================================================
 * RBAC — Role-Based Access Control (which screens and actions a user may use)
 * =============================================================================
 * Think of the ERP as a building with many rooms (modules: Employees, Units, …).
 * This file answers: “Is this person allowed to enter the room?” and “What may they
 * do inside: look only, add new, change, or remove?”
 *
 * Data lives in table `user_permissions`: one row per user per module, with flags
 * can_view, can_create, can_edit, can_delete (stored as 1 or 0). The module name in
 * that table must match the keys in config/modules.js (e.g. employee_master).
 *
 * Special users with role === 1 are treated as full administrators: all modules,
 * all actions, widest row scope (see also lib/rowScope.js for row-level rules).
 *
 * Besides yes/no flags, the same table stores **scopes** for view / edit / delete:
 * own, unit, or all — always interpreted by rowScope.js to filter which *rows* appear (no modules.js opt-out).
 * =============================================================================
 */
import mysql from "mysql2";
import pool from "./db";
import { escapeSqlTableId } from "./sqlModuleTable";
import { normalizeActionScope } from "./permissionScope";

// Maps a friendly action name to the database column that stores the yes/no flag.
const permissionColumnByAction = {
  view: "can_view",
  create: "can_create",
  edit: "can_edit",
  delete: "can_delete"
};

// Which column holds “how wide is data access for this action” (own/unit/all).
const SCOPE_COLUMN_BY_ACTION = {
  view: "view_scope",
  edit: "edit_scope",
  delete: "delete_scope"
};

/**
 * True if the user may perform one action on one module.
 *
 * Parameters:
 * - user — must include id and role; null user → false.
 * - moduleName — string key like "unit_master".
 * - action — "view" | "create" | "edit" | "delete".
 *
 * Returns: boolean. Admins (role 1) always true. Others: database lookup; missing row → false.
 */
export async function hasModulePermission(user, moduleName, action) {
  if (!user) return false;

  // Role 1 is treated as ERP admin with full access.
  if (Number(user.role) === 1) return true;

  const column = permissionColumnByAction[action];
  if (!column) return false;

  const pt = escapeSqlTableId("user_permissions");
  // Single-row lookup: permission values are stored as 1/0 numbers.
  const [rows] = await pool.query(
    `SELECT ${column} AS allowed
     FROM ${pt}
     WHERE user_id=? AND module=?
     LIMIT 1`,
    [user.id, moduleName]
  );

  if (!rows.length) return false;
  return Boolean(rows[0].allowed);
}

/**
 * True if the user has *any* of the four permissions on the module.
 *
 * Used for sidebar / “open this screen” when view alone might be off but create is on.
 * Admins always true.
 */
export async function hasAnyModuleAccess(user, moduleName) {
  if (!user) return false;
  if (Number(user.role) === 1) return true;

  const pt = escapeSqlTableId("user_permissions");
  const [rows] = await pool.query(
    `SELECT (
       COALESCE(can_view,0) OR COALESCE(can_create,0) OR COALESCE(can_edit,0) OR COALESCE(can_delete,0)
     ) AS any_flag
     FROM ${pt}
     WHERE user_id = ? AND module = ?
     LIMIT 1`,
    [user.id, moduleName]
  );

  if (!rows.length) return false;
  return Boolean(Number(rows[0].any_flag));
}

/**
 * Reads the row-level scope for list (view), edit, or delete.
 *
 * Returns a normalized string: 'all' | 'unit' | 'own'. Admins always 'all'.
 * If no permission row exists, defaults to 'all' for that check (lenient default).
 *
 * Used by lib/rowScope.js to build WHERE clauses and per-row button flags.
 */
export async function getScopeForAction(user, moduleName, action) {
  if (!user) return "all";
  if (Number(user.role) === 1) return "all";

  const col = SCOPE_COLUMN_BY_ACTION[action];
  if (!col) return "all";

  const pt = escapeSqlTableId("user_permissions");
  const [rows] = await pool.query(
    `SELECT ${mysql.escapeId(col)} AS sc
     FROM ${pt} WHERE user_id = ? AND module = ?
     LIMIT 1`,
    [user.id, moduleName]
  );
  if (!rows?.length) return "all";
  return normalizeActionScope(rows[0].sc);
}
