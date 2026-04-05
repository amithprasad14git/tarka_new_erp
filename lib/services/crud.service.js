/**
 * =============================================================================
 * CRUD SERVICE — Create, update, and delete records safely (layman overview)
 * =============================================================================
 * This file is the “back office” for saving data. The web pages call API routes;
 * those routes call functions here. Think of it as a checklist before touching
 * the database:
 *
 * 1) Is this a real module we know about? (config/modules.js)
 * 2) Is the module locked read-only? (e.g. Audit Logs)
 * 3) Does this logged-in user have permission for this action? (view/create/edit/delete)
 * 4) For edit/delete: does the row exist? Can this user change *this* row?
 *    (row-level scope from user_permissions is always applied — see lib/rowScope.js)
 * 5) For create/update: clean the incoming JSON, check only allowed fields,
 *    validate types and required fields (crudPayloadValidation.js)
 * 6) Stamp “who modified / when” columns if the module uses them (crudRecordAudit.js)
 * 7) Run the SQL insert/update/delete
 * 8) Write an audit log row — like a diary entry: who did what, old vs new snapshot
 *    (lib/audit.js). Important for trust and troubleshooting.
 *
 * Why PUT passes a *function* to read JSON instead of the body object:
 * We only read the request body *after* we know the user may edit this row.
 * That avoids accepting huge payloads before we have checked permissions.
 *
 * Returns: `{ status: HTTP number, body: object }` so thin API routes can reply
 * without duplicating business rules.
 * =============================================================================
 */
import { modules } from "../../config/modules";
import pool from "../db";
import { hasModulePermission } from "../rbac";
import { canUserModifyRow } from "../rowScope";
import { writeAuditLog } from "../audit";
import { normalizeCrudPayload } from "../crudNormalize";
import {
  applyCreateAudit,
  applyUpdateAudit,
  getAuditColumnNames,
  moduleHasRowAuditFields,
  stripClientAuditFields
} from "../crudRecordAudit";
import { escapeSqlTableIdForModuleConfig } from "../sqlModuleTable";
import { validateCrudPayloadForWrite } from "./crudPayloadValidation";

/**
 * Lists field names people are allowed to send on create/update.
 * Skips fields marked excludeFromForm (server-only columns like createdBy).
 *
 * Parameters: moduleConfig — one module’s settings from config/modules.js.
 * Returns: array of string field names.
 */
function getAllowedFieldNames(moduleConfig) {
  return (moduleConfig.fields || [])
    .filter((field) => !field.excludeFromForm)
    .map((field) => field.name);
}

/**
 * UPDATE one row by primary key `id`.
 *
 * Flow (simple words):
 * - Find the module → stop if unknown or read-only.
 * - Ask RBAC: may this user edit this module?
 * - Load the current row from the database → stop if missing.
 * - Ask row scope: may this user edit *this* row?
 * - Now read JSON from the client (getRawBody).
 * - Remove fake audit fields from client, normalize empty dates/lookups.
 * - Keep only allowed field names; need at least one column to change.
 * - Validate values against module field types and required rules.
 * - Add “last modified by / when” if the module tracks that.
 * - UPDATE in SQL, then append one audit_logs row with old vs new snapshot.
 *
 * Parameters:
 * - user — logged-in user (id, role, unit, …).
 * - moduleKey — e.g. "employee_master".
 * - id — record id from the URL.
 * - getRawBody — async function that returns parsed JSON (called late on purpose).
 *
 * Returns: Promise of `{ status, body }` where body is `{ ok: true }` or `{ error: "..." }`.
 */
export async function updateCrudRecord(user, moduleKey, id, getRawBody) {
  const moduleConfig = modules[moduleKey];
  if (!moduleConfig) {
    return { status: 404, body: { error: "Unknown module" } };
  }
  if (moduleConfig.readOnly) {
    return { status: 400, body: { error: "Read-only module" } };
  }

  const canEdit = await hasModulePermission(user, moduleKey, "edit");
  if (!canEdit) {
    return { status: 403, body: { error: "Forbidden" } };
  }

  const mt = escapeSqlTableIdForModuleConfig(moduleConfig);
  const [existingRows] = await pool.query(`SELECT * FROM ${mt} WHERE id=? LIMIT 1`, [id]);
  if (!existingRows.length) {
    return { status: 404, body: { error: "Record not found" } };
  }
  const oldRow = existingRows[0];

  if (!(await canUserModifyRow(moduleKey, moduleConfig, user, oldRow, "edit"))) {
    return { status: 403, body: { error: "Forbidden" } };
  }

  const raw = await getRawBody();
  const payload = normalizeCrudPayload(stripClientAuditFields(raw), moduleConfig);
  const allowedFields = getAllowedFieldNames(moduleConfig);
  let updateKeys = Object.keys(payload).filter((key) => allowedFields.includes(key));
  if (!updateKeys.length) {
    return { status: 400, body: { error: "No valid fields to update" } };
  }

  const validationSlice = Object.fromEntries(updateKeys.map((k) => [k, payload[k]]));
  const validationError = validateCrudPayloadForWrite(
    moduleConfig,
    validationSlice,
    "update",
    updateKeys
  );
  if (validationError) {
    return { status: 400, body: { error: validationError } };
  }

  let merged = { ...payload };
  if (moduleHasRowAuditFields(moduleConfig)) {
    const cols = getAuditColumnNames(moduleConfig);
    merged = applyUpdateAudit(merged, user.id, cols);
    updateKeys = [...new Set([...updateKeys, cols.modifiedBy, cols.modifiedAt])];
  }

  const setClause = updateKeys.map((key) => `${key}=?`).join(", ");
  const values = updateKeys.map((key) => merged[key]);
  await pool.query(`UPDATE ${mt} SET ${setClause} WHERE id=?`, [...values, id]);

  const [updatedRows] = await pool.query(`SELECT * FROM ${mt} WHERE id=? LIMIT 1`, [id]);
  await writeAuditLog({
    userId: user.id,
    moduleName: moduleKey,
    action: "update",
    recordId: Number(id),
    oldData: oldRow,
    newData: updatedRows[0] || merged
  });

  return { status: 200, body: { ok: true } };
}

/**
 * CREATE one new row (INSERT).
 *
 * Differences from update:
 * - Checks “create” permission instead of “edit”.
 * - No existing row to load; no row-scope check (scope applies to viewing/editing
 *   existing rows, not to creating a new one in most setups).
 * - Validates required fields for a brand-new record.
 * - On create, if the module has all four audit columns, we set both “created”
 *   and “modified” stamps to the current user and time.
 * - Audit log stores newData only (oldData is null).
 *
 * Parameters:
 * - user — logged-in user.
 * - moduleKey — module name string.
 * - rawBody — already-parsed JSON object from the route (POST reads body once there).
 *
 * Returns: `{ status: 200, body: { ok: true, id: newId } }` on success, or an error shape.
 */
export async function createCrudRecord(user, moduleKey, rawBody) {
  const moduleConfig = modules[moduleKey];
  if (!moduleConfig) {
    return { status: 404, body: { error: "Unknown module" } };
  }
  if (moduleConfig.readOnly) {
    return { status: 400, body: { error: "Read-only module" } };
  }

  const canCreate = await hasModulePermission(user, moduleKey, "create");
  if (!canCreate) {
    return { status: 403, body: { error: "Forbidden" } };
  }

  let payload = normalizeCrudPayload(stripClientAuditFields(rawBody), moduleConfig);
  const allowedFields = getAllowedFieldNames(moduleConfig);
  let insertKeys = Object.keys(payload).filter((key) => allowedFields.includes(key));
  if (!insertKeys.length) {
    return { status: 400, body: { error: "No valid fields to insert" } };
  }

  const validationSlice = Object.fromEntries(insertKeys.map((k) => [k, payload[k]]));
  const validationError = validateCrudPayloadForWrite(
    moduleConfig,
    validationSlice,
    "create",
    insertKeys
  );
  if (validationError) {
    return { status: 400, body: { error: validationError } };
  }

  let merged = { ...payload };
  if (moduleHasRowAuditFields(moduleConfig)) {
    const cols = getAuditColumnNames(moduleConfig);
    merged = applyCreateAudit(merged, user.id, cols);
    insertKeys = [
      ...new Set([
        ...insertKeys,
        cols.createdBy,
        cols.createdAt,
        cols.modifiedBy,
        cols.modifiedAt
      ])
    ];
  }

  const placeholders = insertKeys.map(() => "?").join(", ");
  const values = insertKeys.map((key) => merged[key]);
  const mt = escapeSqlTableIdForModuleConfig(moduleConfig);
  const [result] = await pool.query(
    `INSERT INTO ${mt} (${insertKeys.join(", ")}) VALUES (${placeholders})`,
    values
  );

  const insertId = result.insertId;

  const [newRows] = await pool.query(`SELECT * FROM ${mt} WHERE id=? LIMIT 1`, [insertId]);
  await writeAuditLog({
    userId: user.id,
    moduleName: moduleKey,
    action: "create",
    recordId: insertId,
    oldData: null,
    newData: newRows[0] || merged
  });

  return { status: 200, body: { ok: true, id: insertId } };
}

/**
 * DELETE one row by primary key.
 *
 * No payload validation (nothing to type). Flow: module checks → delete permission →
 * row exists → row scope allows deleting this row → DELETE SQL → audit log with
 * old row snapshot and newData null (meaning “gone”).
 *
 * Parameters: user, moduleKey, id — same idea as update.
 * Returns: `{ status: 200, body: { ok: true } }` or an error object.
 */
export async function deleteCrudRecord(user, moduleKey, id) {
  const moduleConfig = modules[moduleKey];
  if (!moduleConfig) {
    return { status: 404, body: { error: "Unknown module" } };
  }
  if (moduleConfig.readOnly) {
    return { status: 400, body: { error: "Read-only module" } };
  }

  const canDelete = await hasModulePermission(user, moduleKey, "delete");
  if (!canDelete) {
    return { status: 403, body: { error: "Forbidden" } };
  }

  const mt = escapeSqlTableIdForModuleConfig(moduleConfig);
  const [existingRows] = await pool.query(`SELECT * FROM ${mt} WHERE id=? LIMIT 1`, [id]);
  if (!existingRows.length) {
    return { status: 404, body: { error: "Record not found" } };
  }
  const oldRow = existingRows[0];

  if (!(await canUserModifyRow(moduleKey, moduleConfig, user, oldRow, "delete"))) {
    return { status: 403, body: { error: "Forbidden" } };
  }

  await pool.query(`DELETE FROM ${mt} WHERE id=?`, [id]);

  await writeAuditLog({
    userId: user.id,
    moduleName: moduleKey,
    action: "delete",
    recordId: Number(id),
    oldData: oldRow,
    newData: null
  });

  return { status: 200, body: { ok: true } };
}
