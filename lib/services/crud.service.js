/**
 * =============================================================================
 * CRUD SERVICE — Create, update, and delete records safely (layman overview)
 * =============================================================================
 * GENERIC-ONLY SERVICE RULE:
 * - This service is shared by all modules.
 * - Keep module-specific decisions in `lib/modules/<module>.js` (via module adapters),
 *   not as direct `if moduleKey === ...` checks here.
 * - Think of this file as traffic control: permission checks, normalization, common DB flow.
 *
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
import { isReportKey } from "../reportConfig";
import pool from "../db";
import { getScopeForAction, hasModulePermission } from "../rbac";
import { annotateRowsModifyAccess, canUserModifyRow, rowMatchesScope } from "../rowScope";
import { enrichLookupDisplayRows } from "../crudLookupEnrich";
import { loadChildTableRowsForParent } from "../childTablesLoad";
import { buildAuditRecordLabel, pickAuditUpdateSnapshots, writeAuditLog } from "../audit";
import { normalizeCrudPayload } from "../crudNormalize";
import {
  applyCreateAudit,
  applyUpdateAudit,
  getAuditColumnNames,
  moduleHasRowAuditFields,
  stripClientAuditFields
} from "../crudRecordAudit";
import { escapeSqlTableIdForModuleConfig } from "../sqlModuleTable";
import { runAfterCreateInTransaction } from "../moduleAfterCreate";
import { validateCrudPayloadForWrite } from "./crudPayloadValidation";
import { syncChildTablesInTransaction } from "../childTablesSync";
import { getCrudModuleAdapter } from "../modules/crudModuleAdapters";

function crudBlockedForReportKey(moduleKey) {
  if (!isReportKey(moduleKey)) return null;
  return {
    status: 400,
    body: { error: `This key is a report. Use GET /api/reports/${moduleKey}/run` }
  };
}

/**
 * Module-specific checks run through adapter hooks in `lib/modules/crudModuleAdapters.js`.
 * Every module still goes through `validateCrudPayloadForWrite` (types, required fields).
 */

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
  const reportBlock = crudBlockedForReportKey(moduleKey);
  if (reportBlock) return reportBlock;
  // --- Load: resolve module config and reject unknown/read-only modules ---
  const moduleConfig = modules[moduleKey];
  if (!moduleConfig) {
    return { status: 404, body: { error: "Unknown module" } };
  }
  if (moduleConfig.readOnly) {
    return { status: 400, body: { error: "Read-only module" } };
  }

  const moduleAdapter = getCrudModuleAdapter(moduleKey);
  // --- Permission: module-level edit flag ---
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

  // --- Row scope: may this user edit this specific row? ---
  if (!(await canUserModifyRow(moduleKey, moduleConfig, user, oldRow, "edit"))) {
    return { status: 403, body: { error: "Forbidden" } };
  }
  if (moduleAdapter?.beforeUpdateExistingRowEditable) {
    const conn = await pool.getConnection();
    try {
      await moduleAdapter.beforeUpdateExistingRowEditable({ conn, user, oldRow, moduleKey });
    } catch (e) {
      if (e?.code === "NCI_EDIT_LOCKED") return { status: 403, body: { error: e.message } };
      throw e;
    } finally {
      conn.release();
    }
  }

  const raw = await getRawBody();
  const stripped = stripClientAuditFields(raw);
  const childTableRows = stripped.childTableRows;
  const parentRaw = { ...stripped };
  delete parentRaw.childTableRows;

  // --- Validate: normalize empties, whitelist fields, type-check payload ---
  const payload = normalizeCrudPayload(parentRaw, moduleConfig);
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

  if (moduleConfig.childTables?.length || moduleAdapter?.requiresUpdateTransaction === true) {
    const conn = await pool.getConnection();
    let extraAuditLogs = [];
    try {
      await conn.beginTransaction();
      // --- Save: UPDATE parent, optional adapter hooks, then child sync in one transaction ---
      if (moduleAdapter?.beforeUpdateWrite) {
        await moduleAdapter.beforeUpdateWrite({ conn, user, oldRow, merged, childTableRows, id, moduleKey, moduleConfig });
      }
      const values = updateKeys.map((key) => merged[key]);
      await conn.query(`UPDATE ${mt} SET ${setClause} WHERE id=?`, [...values, id]);
      if (moduleAdapter?.afterUpdateWrite) {
        const moduleResult = await moduleAdapter.afterUpdateWrite({
          conn,
          user,
          oldRow,
          merged,
          childTableRows,
          id,
          moduleKey,
          moduleConfig
        });
        extraAuditLogs = Array.isArray(moduleResult?.extraAuditLogs) ? moduleResult.extraAuditLogs : [];
      }
      await syncChildTablesInTransaction(conn, moduleConfig, Number(id), childTableRows);
      await conn.commit();
      // Write any extra audit rows the module adapter returned (e.g. linked records).
      for (const log of extraAuditLogs) {
        const labelRow =
          log.newData && typeof log.newData === "object"
            ? log.newData
            : log.oldData && typeof log.oldData === "object"
              ? log.oldData
              : null;
        const extraSnap =
          log.oldData && log.newData && typeof log.oldData === "object" && typeof log.newData === "object"
            ? pickAuditUpdateSnapshots(log.oldData, log.newData)
            : { oldData: log.oldData, newData: log.newData };
        await writeAuditLog({
          userId: user.id,
          moduleName: log.moduleName,
          action: log.action || "update",
          recordId: Number(log.recordId),
          recordLabel: buildAuditRecordLabel(log.moduleName, labelRow, Number(log.recordId)),
          oldData: extraSnap.oldData,
          newData: extraSnap.newData
        });
      }
    } catch (e) {
      try {
        await conn.rollback();
      } catch {
        /* ignore rollback errors */
      }
      // Expected failures from module adapters / hooks: throw { code, message }. Maps to HTTP 400 for
      // user-visible fixes. Accounts codes come from lib/modules/accounts*.js (e.g. loan validations,
      // suspense voucher stamp). Keep in sync when adding new ACCOUNTS_*_VALIDATION_FAILED codes.
      if (
        e?.code === "CHILD_ROWS_INVALID" ||
        e?.code === "NCI_VALIDATION_FAILED" ||
        e?.code === "TRANSFER_CASE_VALIDATION_FAILED" ||
        e?.code === "PUBLIC_NOTICE_VALIDATION_FAILED" ||
        e?.code === "RETURN_CASE_VALIDATION_FAILED" ||
        e?.code === "SARFAESI_CASE_STATUS_UPDATE_VALIDATION_FAILED" ||
        e?.code === "INVOICES_RECEIVED_VALIDATION_FAILED" ||
        e?.code === "ACCOUNTS_ASSETS_INVESTMENTS_VALIDATION_FAILED" ||
        e?.code === "ACCOUNTS_CASH_DEPOSIT_WITHDRAW_VALIDATION_FAILED" ||
        e?.code === "ACCOUNTS_CURRENT_AC_TRANSFER_VALIDATION_FAILED" ||
        e?.code === "ACCOUNTS_EXPENSE_VOUCHER_VALIDATION_FAILED" ||
        e?.code === "ACCOUNTS_LOAN_AC_VALIDATION_FAILED" ||
        e?.code === "ACCOUNTS_SUSPENSE_ENTRY_VALIDATION_FAILED" ||
        e?.code === "USER_PERMISSIONS_VALIDATION_FAILED" ||
        e?.code === "RECOVERY_INVOICE_VALIDATION_FAILED" ||
        e?.code === "SARFAESI_INVOICE_VALIDATION_FAILED" ||
        e?.code === "VEHICLE_INVOICE_VALIDATION_FAILED" ||
        e?.code === "INVOICE_CASE_FINAL_BLOCKED"
      ) {
        return { status: 400, body: { error: e.message } };
      }
      console.error("updateCrudRecord:", e);
      return { status: 500, body: { error: "Failed to update record" } };
    } finally {
      conn.release();
    }
  } else {
    const values = updateKeys.map((key) => merged[key]);
    await pool.query(`UPDATE ${mt} SET ${setClause} WHERE id=?`, [...values, id]);
  }

  const [updatedRows] = await pool.query(`SELECT * FROM ${mt} WHERE id=? LIMIT 1`, [id]);
  const savedRow = updatedRows[0] || merged;
  const updateSnap = pickAuditUpdateSnapshots(oldRow, savedRow);
  // --- Audit: diary entry with only changed columns on update ---
  await writeAuditLog({
    userId: user.id,
    moduleName: moduleKey,
    action: "update",
    recordId: Number(id),
    recordLabel: buildAuditRecordLabel(moduleKey, savedRow, Number(id)),
    oldData: updateSnap.oldData,
    newData: updateSnap.newData
  });

  const body = moduleAdapter?.buildUpdateResponseBody
    ? moduleAdapter.buildUpdateResponseBody({ moduleConfig, id, savedRow, moduleKey })
    : { ok: true };

  return { status: 200, body };
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
 * - Create uses a single database transaction: INSERT, then optional “after create”
 *   steps (e.g. Case No for New Case Inward), then COMMIT. If those steps fail,
 *   the INSERT is undone. The audit log is written only after a successful commit.
 *
 * Parameters:
 * - user — logged-in user.
 * - moduleKey — module name string.
 * - rawBody — already-parsed JSON object from the route (POST reads body once there).
 *
 * Returns: `{ status: 200, body: { ok: true, id: newId } }` on success, or an error shape.
 */
export async function createCrudRecord(user, moduleKey, rawBody) {
  const reportBlock = crudBlockedForReportKey(moduleKey);
  if (reportBlock) return reportBlock;
  // --- Load: module config and read-only guard ---
  const moduleConfig = modules[moduleKey];
  if (!moduleConfig) {
    return { status: 404, body: { error: "Unknown module" } };
  }
  if (moduleConfig.readOnly) {
    return { status: 400, body: { error: "Read-only module" } };
  }

  const moduleAdapter = getCrudModuleAdapter(moduleKey);
  const canCreate = await hasModulePermission(user, moduleKey, "create");
  if (!canCreate) {
    return { status: 403, body: { error: "Forbidden" } };
  }

  const strippedBody = stripClientAuditFields(rawBody);
  const childTableRows = strippedBody.childTableRows;
  const parentRawBody = { ...strippedBody };
  delete parentRawBody.childTableRows;

  let payload = normalizeCrudPayload(parentRawBody, moduleConfig);
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
  const mt = escapeSqlTableIdForModuleConfig(moduleConfig);

  // One transaction: insert + module-specific follow-up (lib/moduleAfterCreate.js) — e.g. Case No, or
  // stamping voucherNo for accounts_loan_ac / accounts_suspense_entry / other voucher modules.
  const conn = await pool.getConnection();
  let extraAuditLogs = [];
  try {
    await conn.beginTransaction();
    // --- Save: INSERT parent, after-create hooks, child sync, then commit ---
    if (moduleAdapter?.beforeCreateWrite) {
      await moduleAdapter.beforeCreateWrite({ conn, user, merged, childTableRows, moduleKey, moduleConfig });
    }
    const values = insertKeys.map((key) => merged[key]);
    const [result] = await conn.query(
      `INSERT INTO ${mt} (${insertKeys.join(", ")}) VALUES (${placeholders})`,
      values
    );
    const insertId = result.insertId;
    await runAfterCreateInTransaction(conn, moduleKey, insertId);
    if (moduleAdapter?.afterCreateWrite) {
      const moduleResult = await moduleAdapter.afterCreateWrite({
        conn,
        user,
        insertId,
        merged,
        moduleKey,
        moduleConfig
      });
      extraAuditLogs = Array.isArray(moduleResult?.extraAuditLogs) ? moduleResult.extraAuditLogs : [];
    }
    await syncChildTablesInTransaction(conn, moduleConfig, insertId, childTableRows);
    await conn.commit();

    const [newRows] = await pool.query(`SELECT * FROM ${mt} WHERE id=? LIMIT 1`, [insertId]);
    const createdRow = newRows[0] || merged;
    await writeAuditLog({
      userId: user.id,
      moduleName: moduleKey,
      action: "create",
      recordId: insertId,
      recordLabel: buildAuditRecordLabel(moduleKey, createdRow, insertId),
      oldData: null,
      newData: createdRow
    });
    for (const log of extraAuditLogs) {
      const labelRow =
        log.newData && typeof log.newData === "object"
          ? log.newData
          : log.oldData && typeof log.oldData === "object"
            ? log.oldData
            : null;
      const extraSnap =
        log.oldData && log.newData && typeof log.oldData === "object" && typeof log.newData === "object"
          ? pickAuditUpdateSnapshots(log.oldData, log.newData)
          : { oldData: log.oldData, newData: log.newData };
      await writeAuditLog({
        userId: user.id,
        moduleName: log.moduleName,
        action: log.action || "update",
        recordId: Number(log.recordId),
        recordLabel: buildAuditRecordLabel(log.moduleName, labelRow, Number(log.recordId)),
        oldData: extraSnap.oldData,
        newData: extraSnap.newData
      });
    }

    const body = { ok: true, id: insertId };
    // Generic acknowledgement payload: any module with `postCreateAck` in config/modules.js can return
    // a highlighted field after create (e.g. voucherNo filled by runAfterCreateInTransaction for loan ac / suspense).
    const ackCfg = modules[moduleKey]?.postCreateAck;
    if (ackCfg?.field) {
      const raw = createdRow?.[ackCfg.field];
      if (raw != null && String(raw).trim() !== "") {
        body.postCreateAck = { field: ackCfg.field, value: String(raw) };
      }
    }
    return { status: 200, body };
  } catch (e) {
    try {
      await conn.rollback();
    } catch {
      /* ignore rollback errors */
    }
    console.error("createCrudRecord:", e);
    // Expected business/data errors (user-fixable): Case No / NCI / transfer / accounts modules, etc.
    // Accounts: ACCOUNTS_LOAN_AC_* (adapter + stamp in transaction), ACCOUNTS_SUSPENSE_ENTRY_* (stamp).
    if (
      e?.code === "CASE_NO_PREFIX_UNRESOLVED" ||
      e?.code === "CASE_NO_PREFIX_EMPTY" ||
      e?.code === "LOAN_CATEGORY_MISSING" ||
      e?.code === "LOAN_CATEGORY_CASE_NO_MAP_MISSING" ||
      e?.code === "LOAN_CATEGORY_CASE_NO_UNKNOWN" ||
      e?.code === "CASE_NO_SEQUENCE_ROW" ||
      e?.code === "CHILD_ROWS_INVALID" ||
      e?.code === "NCI_VALIDATION_FAILED" ||
      e?.code === "TRANSFER_CASE_VALIDATION_FAILED" ||
      e?.code === "PUBLIC_NOTICE_VALIDATION_FAILED" ||
      e?.code === "RETURN_CASE_VALIDATION_FAILED" ||
      e?.code === "SARFAESI_CASE_STATUS_UPDATE_VALIDATION_FAILED" ||
      e?.code === "INVOICES_RECEIVED_VALIDATION_FAILED" ||
      e?.code === "ACCOUNTS_ASSETS_INVESTMENTS_VALIDATION_FAILED" ||
      e?.code === "ACCOUNTS_CASH_DEPOSIT_WITHDRAW_VALIDATION_FAILED" ||
      e?.code === "ACCOUNTS_CURRENT_AC_TRANSFER_VALIDATION_FAILED" ||
      e?.code === "ACCOUNTS_EXPENSE_VOUCHER_VALIDATION_FAILED" ||
      e?.code === "ACCOUNTS_LOAN_AC_VALIDATION_FAILED" ||
      e?.code === "ACCOUNTS_SUSPENSE_ENTRY_VALIDATION_FAILED" ||
      e?.code === "USER_PERMISSIONS_VALIDATION_FAILED" ||
      e?.code === "RECOVERY_INVOICE_VALIDATION_FAILED" ||
      e?.code === "SARFAESI_INVOICE_VALIDATION_FAILED" ||
      e?.code === "VEHICLE_INVOICE_VALIDATION_FAILED" ||
      e?.code === "INVOICE_CASE_FINAL_BLOCKED"
    ) {
      return { status: 400, body: { error: e.message } };
    }
    return { status: 500, body: { error: "Failed to create record" } };
  } finally {
    conn.release();
  }
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
  const reportBlock = crudBlockedForReportKey(moduleKey);
  if (reportBlock) return reportBlock;
  const moduleConfig = modules[moduleKey];
  if (!moduleConfig) {
    return { status: 404, body: { error: "Unknown module" } };
  }
  if (moduleConfig.readOnly) {
    return { status: 400, body: { error: "Read-only module" } };
  }

  // --- Permission + row scope before destructive DELETE ---
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
    recordLabel: buildAuditRecordLabel(moduleKey, oldRow, Number(id)),
    oldData: oldRow,
    newData: null
  });

  return { status: 200, body: { ok: true } };
}

/**
 * GET one parent row by id for the entry form, with child line items when `childTables` is configured.
 * Enforces view (or edit) module permission and view row scope; enriches lookups and `_canEdit` / `_canDelete`.
 *
 * Returns `{ status, body: { data, childTableRows } }` on success. `childTableRows` keys match `childTables[].key`.
 */
export async function getCrudRecordById(user, moduleKey, id) {
  const reportBlock = crudBlockedForReportKey(moduleKey);
  if (reportBlock) return reportBlock;
  const moduleConfig = modules[moduleKey];
  if (!moduleConfig) {
    return { status: 404, body: { error: "Unknown module" } };
  }

  const moduleAdapter = getCrudModuleAdapter(moduleKey);
  // --- Load: view or edit permission required to open the entry form ---
  const canView = await hasModulePermission(user, moduleKey, "view");
  const canEdit = await hasModulePermission(user, moduleKey, "edit");
  if (!canView && !canEdit) {
    return { status: 403, body: { error: "Forbidden" } };
  }

  const mt = escapeSqlTableIdForModuleConfig(moduleConfig);
  const [existingRows] = await pool.query(`SELECT * FROM ${mt} WHERE id=? LIMIT 1`, [id]);
  if (!existingRows.length) {
    return { status: 404, body: { error: "Record not found" } };
  }
  const row = existingRows[0];

  const viewScope = await getScopeForAction(user, moduleKey, "view");
  if (!(await rowMatchesScope(moduleConfig, user, viewScope, row))) {
    return { status: 404, body: { error: "Record not found" } };
  }

  await enrichLookupDisplayRows(moduleConfig, [row]);

  const canDelete = await hasModulePermission(user, moduleKey, "delete");
  // Attach per-row edit/delete flags for the form toolbar.
  await annotateRowsModifyAccess(moduleKey, moduleConfig, user, [row], { canEdit, canDelete });
  if (moduleAdapter?.afterGetById) {
    const conn = await pool.getConnection();
    try {
      await moduleAdapter.afterGetById({ conn, user, row, moduleKey, moduleConfig });
    } finally {
      conn.release();
    }
  }

  let childTableRows = {};
  if (moduleConfig.childTables?.length) {
    // --- Child sync (load): fetch line-item grids for this parent id ---
    childTableRows = (await loadChildTableRowsForParent(moduleConfig, Number(id))) || {};
    for (const ct of moduleConfig.childTables) {
      const key = ct.key || ct.table;
      const childRows = childTableRows[key];
      if (childRows?.length && ct.fields?.length) {
        await enrichLookupDisplayRows({ fields: ct.fields }, childRows);
      }
    }
  }

  return { status: 200, body: { data: row, childTableRows } };
}
