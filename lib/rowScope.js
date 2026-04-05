/**
 * =============================================================================
 * ROW-LEVEL SECURITY — Who may see or change *which rows* (mandatory)
 * =============================================================================
 * In plain language:
 * - Module permissions (can_view, can_edit, …) answer: “May I use this screen at all?”
 * - Row-level rules answer: “Within that screen, may I see *every* row, only *my* rows,
 *   or only rows tied to *my unit*?”
 *
 * **Those row rules always come from the database table `user_permissions`,** not from
 * config/modules.js. Columns `view_scope`, `edit_scope`, and `delete_scope` hold one of:
 * **all** (see everything), **own** (only rows you created — using the createdBy field),
 * or **unit** (only rows whose *creator’s* business unit matches yours on your user profile).
 *
 * **Why enforcement is mandatory (no opt-out in modules.js):**
 * Previously, a flag on each module could accidentally disable all row filtering. That
 * meant someone with “edit” could change every row even when the matrix said “own” or
 * “unit”. We removed that flag so row-level checks **always** run for list, update, and
 * delete. The only ways to see all rows are: scope set to **all** in `user_permissions`,
 * or the user is a full admin (role 1), or the effective scope is **all** when no row
 * exists (see lib/rbac.js getScopeForAction defaults).
 *
 * **How this file connects to the rest of the app:**
 * - lib/rbac.js **reads** scope strings from `user_permissions` (getScopeForAction).
 * - This file **applies** them: extra SQL for lists (appendRowScopeFilter), checks on one
 *   row for PUT/DELETE (rowMatchesScope, canUserModifyRow), and per-row UI flags on grids
 *   (annotateRowsModifyAccess).
 * - lib/services/crud.service.js calls canUserModifyRow before update/delete.
 * - Audit logging is unchanged; it still records who changed what after these checks pass.
 *
 * **Special case — `users` table under “own”:** You can always open your own login row
 * (match id) even if someone else created that record, so people can edit their profile.
 *
 * **Misconfiguration:** If a module has no `createdBy` field in config but scope is own/unit,
 * we play safe: lists may return no rows (unit) or skip own filters where the column is
 * missing; edit/delete checks follow the same defensive rules.
 * =============================================================================
 */
import mysql from "mysql2";
import pool from "./db";
import { escapeSqlTableId } from "./sqlModuleTable";
import { getAuditColumnNames } from "./crudRecordAudit";
import { getScopeForAction } from "./rbac";

/**
 * Normalizes a scope string from the database to one of: "own" | "unit" | "all".
 * Unknown or blank values become "all" (most permissive default for bad data).
 */
export function normalizeDataScope(s) {
  const v = String(s ?? "all").trim().toLowerCase();
  if (v === "own") return "own";
  if (v === "unit") return "unit";
  return "all";
}

/** Quick lookup: set of all field names defined on a module. */
function fieldNameSet(moduleConfig) {
  return new Set((moduleConfig?.fields || []).map((f) => f.name));
}

/**
 * Adds SQL WHERE pieces so the *list* query only returns rows the user is allowed to see
 * for the current scope (view/edit/delete — whichever the caller passed in from getScopeForAction).
 *
 * **Always runs** for every module: there is no config switch to skip this.
 * Does nothing when: scope is "all", or the user is role 1 (admin bypass), or own/unit
 * cannot be applied because required fields are missing (defensive behavior below).
 *
 * Parameters:
 * - moduleConfig — screen definition from config/modules.js (field list, table name).
 * - user — logged-in user (needs id, role, unit for checks).
 * - scope — raw scope string from user_permissions (normalized inside).
 * - whereParts / whereValues — appended like other list filters.
 */
export function appendRowScopeFilter(moduleConfig, user, scope, whereParts, whereValues) {
  const sc = normalizeDataScope(scope);
  if (sc === "all") return;
  if (user && Number(user.role) === 1) return;

  const fn = fieldNameSet(moduleConfig);
  const cols = getAuditColumnNames(moduleConfig);
  const createdBy = cols.createdBy;
  const hasCreatedBy = fn.has(createdBy);

  if (sc === "own") {
    if (!hasCreatedBy) return;
    // `users` table: "own" includes the logged-in account row (id) and rows that user created.
    if (moduleConfig.table === "users") {
      const cb = mysql.escapeId(createdBy);
      whereParts.push(`(${mysql.escapeId("id")} = ? OR ${cb} = ?)`);
      whereValues.push(user.id, user.id);
      return;
    }
    whereParts.push(`${mysql.escapeId(createdBy)} = ?`);
    whereValues.push(user.id);
    return;
  }

  if (sc === "unit") {
    const uid = user?.unit != null && user.unit !== "" ? Number(user.unit) : null;
    if (!Number.isFinite(uid)) {
      whereParts.push("1=0");
      return;
    }
    if (hasCreatedBy) {
      const ut = escapeSqlTableId("users");
      whereParts.push(
        `${mysql.escapeId(createdBy)} IN (SELECT ${mysql.escapeId("id")} FROM ${ut} WHERE ${mysql.escapeId("unit")} = ?)`
      );
      whereValues.push(uid);
      return;
    }
    whereParts.push("1=0");
  }
}

/**
 * Checks one loaded row against the user’s scope (used before edit/delete).
 *
 * Returns true if the row is allowed, false if not. Admins and "all" scope always pass.
 * For "unit", may run a small query to read the creator’s unit from users.
 */
export async function rowMatchesScope(moduleConfig, user, scope, row) {
  const sc = normalizeDataScope(scope);
  if (sc === "all") return true;
  if (user && Number(user.role) === 1) return true;

  const fn = fieldNameSet(moduleConfig);
  const cols = getAuditColumnNames(moduleConfig);
  const createdBy = cols.createdBy;
  const hasCreatedBy = fn.has(createdBy);

  if (sc === "own") {
    if (!hasCreatedBy) return true;
    if (moduleConfig.table === "users") {
      return (
        Number(row.id) === Number(user.id) ||
        Number(row[createdBy]) === Number(user.id)
      );
    }
    return Number(row[createdBy]) === Number(user.id);
  }

  if (sc === "unit") {
    const uid = user?.unit != null && user.unit !== "" ? Number(user.unit) : null;
    if (!Number.isFinite(uid)) return false;
    if (!hasCreatedBy) return false;
    const id = row[createdBy];
    const ut = escapeSqlTableId("users");
    const [cr] = await pool.query(
      `SELECT ${mysql.escapeId("unit")} FROM ${ut} WHERE ${mysql.escapeId("id")} = ? LIMIT 1`,
      [id]
    );
    const cu = cr[0]?.unit;
    return Number(cu) === uid;
  }

  return true;
}

/**
 * After a list is loaded, adds `_canEdit` and `_canDelete` on each row so the UI can
 * grey out buttons without asking the server row-by-row.
 *
 * **Always** applies edit_scope / delete_scope from user_permissions (plus module can_edit /
 * can_delete). Admins get true for every row. Same matching rules as rowMatchesScope, with
 * batched DB reads for "unit" scope.
 */
export async function annotateRowsModifyAccess(moduleKey, moduleConfig, user, rows, flags) {
  const { canEdit, canDelete } = flags;
  if (!Array.isArray(rows) || rows.length === 0) return;

  if (user && Number(user.role) === 1) {
    for (const row of rows) {
      row._canEdit = true;
      row._canDelete = true;
    }
    return;
  }

  const editScope = await getScopeForAction(user, moduleKey, "edit");
  const deleteScope = await getScopeForAction(user, moduleKey, "delete");
  const cols = getAuditColumnNames(moduleConfig);
  const createdBy = cols.createdBy;
  const fn = fieldNameSet(moduleConfig);
  const hasCreatedBy = fn.has(createdBy);

  const es = normalizeDataScope(editScope);
  const ds = normalizeDataScope(deleteScope);
  const uid = user?.unit != null && user.unit !== "" ? Number(user.unit) : null;

  let unitByUserId = new Map();
  if (hasCreatedBy && (es === "unit" || ds === "unit") && (canEdit || canDelete)) {
    const ids = new Set();
    for (const row of rows) {
      const id = row[createdBy];
      if (id != null && id !== "") ids.add(Number(id));
    }
    const idList = [...ids].filter(Number.isFinite);
    if (idList.length) {
      const ph = idList.map(() => "?").join(",");
      const ut = escapeSqlTableId("users");
      const [urows] = await pool.query(
        `SELECT ${mysql.escapeId("id")}, ${mysql.escapeId("unit")} FROM ${ut} WHERE ${mysql.escapeId("id")} IN (${ph})`,
        idList
      );
      for (const ur of urows || []) {
        unitByUserId.set(Number(ur.id), ur.unit != null ? Number(ur.unit) : NaN);
      }
    }
  }

  /**
   * Inner helper: does this row pass one scope string for edit or delete?
   */
  function matches(scopeRaw, row) {
    const sc = normalizeDataScope(scopeRaw);
    if (sc === "all") return true;
    if (sc === "own") {
      if (!hasCreatedBy) return true;
      if (moduleConfig.table === "users") {
        return (
          Number(row.id) === Number(user.id) ||
          Number(row[createdBy]) === Number(user.id)
        );
      }
      return Number(row[createdBy]) === Number(user.id);
    }
    if (sc === "unit") {
      if (!hasCreatedBy) return false;
      if (!Number.isFinite(uid)) return false;
      const cu = unitByUserId.get(Number(row[createdBy]));
      return Number(cu) === uid;
    }
    return true;
  }

  for (const row of rows) {
    row._canEdit = Boolean(canEdit) && matches(editScope, row);
    row._canDelete = Boolean(canDelete) && matches(deleteScope, row);
  }
}

/**
 * Used by the update/delete API: may this user change *this* row?
 *
 * Loads edit_scope or delete_scope from user_permissions and delegates to rowMatchesScope.
 * **Always enforced** — no module config opt-out.
 */
export async function canUserModifyRow(moduleKey, moduleConfig, user, row, action) {
  const scope = await getScopeForAction(user, moduleKey, action === "delete" ? "delete" : "edit");
  return rowMatchesScope(moduleConfig, user, scope, row);
}
