// Application route/page/API handler for this feature area.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * =============================================================================
 * GENERIC CRUD API — `/api/crud/<module name>`
 * =============================================================================
 * One route file powers many screens. The `<module>` part of the URL must match a key
 * in config/modules.js (e.g. employee_master). No coding is needed to add a new module
 * if it follows the same pattern: list (GET), create (POST).
 *
 * GET — “Give me a page of rows” with filters, search, sort, paging. Also adds friendly
 *       labels for lookup columns and flags per row whether Edit/Delete should show.
 *
 * POST — “Save a new row” — body is JSON. Actual work lives in lib/services/crud.service
 *        (permissions, validation, audit, SQL).
 *
 * Error handling pattern: try/catch logs the real error server-side, client gets a short
 * generic message for 500 errors so internal details are not leaked. 401/403/404/400
 * return specific JSON { error: "..." } from checks or from the service return value.
 * =============================================================================
 */
import { modules } from "../../../../config/modules";
import { isReportKey } from "../../../../lib/reportConfig";
import pool, { queryWithRetry } from "../../../../lib/db";
import { cookies } from "next/headers";
import { getSessionUser } from "../../../../lib/session";
import { getScopeForAction, hasModulePermission } from "../../../../lib/rbac";
import { appendRowScopeFilter, annotateRowsModifyAccess } from "../../../../lib/rowScope";
import { enrichLookupDisplayRows } from "../../../../lib/crudLookupEnrich";
import { buildListOrderByExpr, buildListSelectClause } from "../../../../lib/crudListSelect";
import mysql from "mysql2";
import { appendGlobalSearchClause, appendLookupFkFilter } from "../../../../lib/crudListSearch";
import { escapeSqlLikePattern } from "../../../../lib/sqlLikeEscape";
import { escapeSqlTableIdForModuleConfig } from "../../../../lib/sqlModuleTable";
import { createCrudRecord } from "../../../../lib/services/crud.service";
import { canAccessLovViaReferencingModule } from "../../../../lib/lookupLovAccess";
import { applyRole2FinalStageEditLock } from "../../../../lib/modules/newCaseInward";
import { FINAL_CASE_STATUSES } from "../../../../lib/modules/newCaseInwardCaseStatus";
import { appendTransferCaseCasePickerUnitLookupFilter } from "../../../../lib/modules/transferCase";
import { appendInvoiceCasePickerExcludeFinalYesFilter } from "../../../../lib/modules/invoiceFinalInvoice";
import { appendSarfaesiInvoiceCasePickerLoanCategoryFilter } from "../../../../lib/modules/sarfaesiInvoice";
import { appendSarfaesiCaseStatusUpdateCasePickerFilter } from "../../../../lib/modules/sarfaesiCaseStatusUpdate";
import {
  appendInvoicesReceivedRecoveryInvoicePickerFilter,
  appendInvoicesReceivedSarfaesiInvoicePickerFilter,
  appendInvoicesReceivedVehicleInvoicePickerFilter
} from "../../../../lib/modules/invoicesReceived";
import { appendVehicleInvoiceCasePickerLoanCategoryFilter } from "../../../../lib/modules/vehicleInvoice";
import { enrichAuditLogRecordLabels } from "../../../../lib/modules/auditLogsEnrich";
import { parseNumericCellValue } from "../../../../lib/formatInrNumber";
import { appendNumberColumnFilter } from "../../../../lib/crudNumberFilter";

/**
 * Reads the httpOnly session cookie and returns the logged-in user (or null).
 * Side effect: valid sessions get their expiry extended (see getSessionUser).
 */
async function getRequestUser() {
  const cookieStore = await cookies();
  const sid = cookieStore.get("session")?.value;
  return getSessionUser(sid);
}

/**
 * Reads URL query parameters for the list screen: page size, sort column/direction,
 * and per-field filters (f_fieldname, optional _min/_max for numbers).
 *
 * Security note: sort column is **not** taken from the URL blindly — only columns that
 * exist on the module are allowed; otherwise we fall back to sorting by id. This stops
 * malicious sort parameters from breaking queries.
 *
 * Parameters: req — incoming HTTP request; moduleConfig — field list for whitelist.
 * Returns: plain object { page, limit, sortBy, sortDir, offset, filters, search }.
 */
function normalizeListQuery(req, moduleConfig) {
  const url = new URL(req.url);

  // Server-side paging: clamp values to avoid huge queries / negative offsets.
  const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10), 1);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "20", 10), 1), 200);
  const sortByRequested = (url.searchParams.get("sortBy") || "id").trim();
  const sortDirRequested = (url.searchParams.get("sortDir") || "desc").toLowerCase();

  // Prevent SQL injection by allowing sorting only on whitelisted columns.
  const allowedSortColumns = ["id", ...(moduleConfig.fields || []).map((f) => f.name)];
  const sortBy = allowedSortColumns.includes(sortByRequested) ? sortByRequested : "id";
  const sortDir = sortDirRequested === "asc" ? "ASC" : "DESC";
  const offset = (page - 1) * limit;

  const fields = moduleConfig.fields || [];
  const filters = {};
  for (const field of fields) {
    const exact = (url.searchParams.get(`f_${field.name}`) || "").trim();
    const min = (url.searchParams.get(`f_${field.name}_min`) || "").trim();
    const max = (url.searchParams.get(`f_${field.name}_max`) || "").trim();
    if (exact) filters[`f_${field.name}`] = exact;
    if (min) filters[`f_${field.name}_min`] = min;
    if (max) filters[`f_${field.name}_max`] = max;
  }

  const search = (url.searchParams.get("search") || "").trim();

  return { page, limit, sortBy, sortDir, offset, filters, search };
}

/**
 * GET /api/crud/<module> — paged list with optional filters and search.
 *
 * Step-by-step:
 * 1) Require login.
 * 2) Resolve module config; unknown module → 404.
 * 3) Load four permission booleans; if user has none of view/create/edit/delete → 403.
 * 4) Special case: user may create only (no view) — return empty list so the “new” form can open.
 * 5) Build WHERE clauses from column filters, global search, and row scope (unless lov=1 mode).
 * 6) COUNT + SELECT with limit/offset; enrich lookup labels; annotate _canEdit/_canDelete.
 * 7) JSON response { data, meta }.
 */
// Paged grid list with filters, search, row scope, and module-specific LoV rules.
export async function GET(req, { params }) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { module } = await params;
    if (isReportKey(module)) {
      return Response.json(
        { error: "This key is a report. Use GET /api/reports/" + module + "/run" },
        { status: 400 }
      );
    }
    const m = modules[module];
    if (!m) {
      return Response.json({ error: "Unknown module" }, { status: 404 });
    }

    const canView = await hasModulePermission(user, module, "view");
    const canCreate = await hasModulePermission(user, module, "create");
    const canEdit = await hasModulePermission(user, module, "edit");
    const canDelete = await hasModulePermission(user, module, "delete");

    const listUrl = new URL(req.url);
    const forLookup = listUrl.searchParams.get("lov") === "1";

    const canAnyOnModule = canView || canCreate || canEdit || canDelete;
    let canList = canAnyOnModule;
    if (forLookup && !canList) {
      canList = await canAccessLovViaReferencingModule(user, module);
    }
    if (!canList) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { page, limit, sortBy, sortDir, offset, filters, search } = normalizeListQuery(req, m);
    const fieldsByName = Object.fromEntries((m.fields || []).map((f) => [f.name, f]));

    // Create-only (no view / edit / delete): empty grid — but LoV/picker requests still need rows.
    if (!forLookup && !canView && canCreate && !canEdit && !canDelete) {
      return Response.json({
        data: [],
        meta: {
          page,
          limit,
          total: 0,
          totalPages: 1,
          sortBy,
          sortDir: sortDir.toLowerCase(),
          filters,
          search: search || undefined
        }
      });
    }

    const mt = escapeSqlTableIdForModuleConfig(m);
    const whereParts = [];
    const whereValues = [];

    // Turn each active filter from the URL into SQL (type-aware).
    for (const [key, value] of Object.entries(filters)) {
      if (key.endsWith("_min")) {
        const fieldName = key.replace("f_", "").replace("_min", "");
        const ft = fieldsByName[fieldName]?.type;
        if (ft === "number" || ft === "lookup") {
          const n = parseNumericCellValue(value);
          if (n == null) continue;
          whereParts.push(`${mysql.escapeId(fieldName)} >= ?`);
          whereValues.push(n);
        }
        continue;
      }
      if (key.endsWith("_max")) {
        const fieldName = key.replace("f_", "").replace("_max", "");
        const ft = fieldsByName[fieldName]?.type;
        if (ft === "number" || ft === "lookup") {
          const n = parseNumericCellValue(value);
          if (n == null) continue;
          whereParts.push(`${mysql.escapeId(fieldName)} <= ?`);
          whereValues.push(n);
        }
        continue;
      }
      const fieldName = key.replace("f_", "");
      const field = fieldsByName[fieldName];
      if (!field) continue;
      if (field.type === "text" || field.type === "email") {
        whereParts.push(`${mysql.escapeId(fieldName)} LIKE ?`);
        whereValues.push(`%${value}%`);
      } else if (field.type === "lookup") {
        const n = parseNumericCellValue(value);
        // LoV API only: f_unit=5 means FK id. View-grid filters always search labels (e.g. caseNo 10011 → B/VL/10011).
        if (forLookup && n != null) {
          whereParts.push(`${mysql.escapeId(fieldName)} = ?`);
          whereValues.push(n);
        } else {
          appendLookupFkFilter(fieldName, field, value, whereParts, whereValues);
        }
      } else if (field.type === "number") {
        appendNumberColumnFilter(fieldName, field, value, whereParts, whereValues);
      } else if (field.type === "date") {
        // DATE_FORMAT → string (dd-mm-yyyy); LIKE runs on that text, not on raw DATE equality.
        const needle = escapeSqlLikePattern(String(value).trim());
        whereParts.push(
          `DATE_FORMAT(${mysql.escapeId(fieldName)}, '%d-%m-%Y') LIKE ? ESCAPE '\\\\'`
        );
        whereValues.push(`%${needle}%`);
      } else {
        whereParts.push(`${mysql.escapeId(fieldName)} = ?`);
        whereValues.push(value);
      }
    }

    appendGlobalSearchClause(m, search, whereParts, whereValues);

    // FK LoV / picker: full reference list for dropdowns. Row scope still applies to normal grid lists.
    if (module === "lookup_value_master" && forLookup) {
      const filterName = (listUrl.searchParams.get("filterLookupTypeName") || "").trim().slice(0, 200);
      const filterIdRaw = (listUrl.searchParams.get("filterLookupType") || "").trim();
      if (filterName) {
        const ltm = modules.lookup_type_master;
        if (ltm?.table) {
          const subTable = escapeSqlTableIdForModuleConfig(ltm);
          whereParts.push(
            `${mysql.escapeId("lookupType")} IN (SELECT id FROM ${subTable} WHERE LOWER(TRIM(lookupType)) = LOWER(TRIM(?)))`
          );
          whereValues.push(filterName);
        }
      } else if (filterIdRaw) {
        const ltId = Number(filterIdRaw);
        if (Number.isFinite(ltId)) {
          whereParts.push(`${mysql.escapeId("lookupType")} = ?`);
          whereValues.push(ltId);
        }
      }
    }
    if (forLookup) {
      const excludeIdRaw = (listUrl.searchParams.get("exclude_id") || "").trim();
      if (excludeIdRaw) {
        const excludeId = Number(excludeIdRaw);
        if (Number.isFinite(excludeId)) {
          // Generic helper for dependent LoV screens (example: Transfer Case To Unit excludes From Unit).
          whereParts.push(`${mysql.escapeId("id")} <> ?`);
          whereValues.push(excludeId);
        }
      }
      // Module-specific LoV filter for NCI case pickers:
      // when requested, show only open cases (exclude final-stage statuses).
      if (module === "new_case_inward" && listUrl.searchParams.get("open_case_only") === "1") {
        const finalStatusLabels = (FINAL_CASE_STATUSES || []).map((s) => String(s || "").trim()).filter(Boolean);
        if (finalStatusLabels.length) {
          const placeholders = finalStatusLabels.map(() => "?").join(", ");
          whereParts.push(
            `(
              ${mysql.escapeId("caseStatus")} IS NULL
              OR ${mysql.escapeId("caseStatus")} NOT IN (
                SELECT id
                FROM ${escapeSqlTableIdForModuleConfig(modules.lookup_value_master)}
                WHERE LOWER(TRIM(${mysql.escapeId("lookupValue")})) IN (${placeholders})
              )
            )`
          );
          whereValues.push(...finalStatusLabels.map((v) => v.toLowerCase()));
        }
      }
      // SARFAESI Case Status Update: Case No picker — SARFAESI loan category; exclude cases already used on another parent.
      if (module === "new_case_inward" && listUrl.searchParams.get("sarfaesi_case_status_update_case_picker") === "1") {
        const parentRaw = (listUrl.searchParams.get("sarfaesi_case_status_update_parent_id") || "").trim();
        const parentId = Number(parentRaw);
        appendSarfaesiCaseStatusUpdateCasePickerFilter({
          mysql,
          mainTableRef: mt,
          whereParts,
          whereValues,
          parentRecordId: Number.isFinite(parentId) && parentId > 0 ? parentId : null
        });
      }
      // Return Case: Case No picker — only "Returned" NCI rows, excluding cases already on another Return Case parent.
      if (module === "new_case_inward" && listUrl.searchParams.get("return_case_case_picker") === "1") {
        const lvm = escapeSqlTableIdForModuleConfig(modules.lookup_value_master);
        whereParts.push(
          `${mysql.escapeId("caseStatus")} IN (
            SELECT ${mysql.escapeId("id")} FROM ${lvm}
            WHERE LOWER(TRIM(${mysql.escapeId("lookupValue")})) = LOWER(TRIM(?))
          )`
        );
        whereValues.push("Returned");
        const rcTable = escapeSqlTableIdForModuleConfig(modules.return_case);
        const parentRaw = (listUrl.searchParams.get("return_case_parent_id") || "").trim();
        const parentId = Number(parentRaw);
        const nciRef = `${mt}.${mysql.escapeId("id")}`;
        if (Number.isFinite(parentId) && parentId > 0) {
          whereParts.push(
            `NOT EXISTS (
              SELECT 1 FROM ${rcTable} rc
              WHERE rc.${mysql.escapeId("caseNo")} = ${nciRef}
                AND rc.${mysql.escapeId("id")} <> ?
            )`
          );
          whereValues.push(parentId);
        } else {
          whereParts.push(
            `NOT EXISTS (SELECT 1 FROM ${rcTable} rc WHERE rc.${mysql.escapeId("caseNo")} = ${nciRef})`
          );
        }
      }
      // Recovery / SARFAESI / Vehicle Invoice: Case No picker — exclude cases whose status is "Returned".
      if (
        module === "new_case_inward" &&
        (listUrl.searchParams.get("recovery_invoice_case_picker") === "1" ||
          listUrl.searchParams.get("sarfaesi_invoice_case_picker") === "1" ||
          listUrl.searchParams.get("vehicle_invoice_case_picker") === "1")
      ) {
        const lvm = escapeSqlTableIdForModuleConfig(modules.lookup_value_master);
        whereParts.push(
          `(
            ${mysql.escapeId("caseStatus")} IS NULL
            OR ${mysql.escapeId("caseStatus")} NOT IN (
              SELECT ${mysql.escapeId("id")} FROM ${lvm}
              WHERE LOWER(TRIM(${mysql.escapeId("lookupValue")})) = LOWER(TRIM(?))
            )
          )`
        );
        whereValues.push("Returned");
        appendInvoiceCasePickerExcludeFinalYesFilter({ mysql, mainTableRef: mt, whereParts, whereValues });
      }
      // SARFAESI Invoice: Case No picker — Loan Category must be SARFAESI (lookup_type / lookup_value master).
      if (module === "new_case_inward" && listUrl.searchParams.get("sarfaesi_invoice_case_picker") === "1") {
        appendSarfaesiInvoiceCasePickerLoanCategoryFilter({ mysql, mainTableRef: mt, whereParts, whereValues });
      }
      // Vehicle Invoice: Case No picker — Loan Category must be Vehicle Loan (lookup_type / lookup_value master).
      if (module === "new_case_inward" && listUrl.searchParams.get("vehicle_invoice_case_picker") === "1") {
        appendVehicleInvoiceCasePickerLoanCategoryFilter({ mysql, mainTableRef: mt, whereParts, whereValues });
      }
      // Invoices Received: invoice pickers — exclude invoices already on another received record.
      if (module === "recovery_invoice" && listUrl.searchParams.get("invoices_received_recovery_picker") === "1") {
        const parentRaw = (listUrl.searchParams.get("invoices_received_parent_id") || "").trim();
        const parentId = Number(parentRaw);
        appendInvoicesReceivedRecoveryInvoicePickerFilter({
          mysql,
          mainTableRef: mt,
          whereParts,
          whereValues,
          parentRecordId: Number.isFinite(parentId) && parentId > 0 ? parentId : null
        });
      }
      if (module === "sarfaesi_invoice" && listUrl.searchParams.get("invoices_received_sarfaesi_picker") === "1") {
        const parentRaw = (listUrl.searchParams.get("invoices_received_parent_id") || "").trim();
        const parentId = Number(parentRaw);
        appendInvoicesReceivedSarfaesiInvoicePickerFilter({
          mysql,
          mainTableRef: mt,
          whereParts,
          whereValues,
          parentRecordId: Number.isFinite(parentId) && parentId > 0 ? parentId : null
        });
      }
      if (module === "vehicle_invoice" && listUrl.searchParams.get("invoices_received_vehicle_picker") === "1") {
        const parentRaw = (listUrl.searchParams.get("invoices_received_parent_id") || "").trim();
        const parentId = Number(parentRaw);
        appendInvoicesReceivedVehicleInvoicePickerFilter({
          mysql,
          mainTableRef: mt,
          whereParts,
          whereValues,
          parentRecordId: Number.isFinite(parentId) && parentId > 0 ? parentId : null
        });
      }
      // Transfer Case: Case No picker — allow all case statuses, but exclude cases already used in transfer_case.caseNo.
      if (module === "new_case_inward" && listUrl.searchParams.get("transfer_case_case_picker") === "1") {
        const tcTable = escapeSqlTableIdForModuleConfig(modules.transfer_case);
        const parentRaw = (listUrl.searchParams.get("transfer_case_parent_id") || "").trim();
        const parentId = Number(parentRaw);
        const nciRef = `${mt}.${mysql.escapeId("id")}`;
        if (Number.isFinite(parentId) && parentId > 0) {
          whereParts.push(
            `NOT EXISTS (
              SELECT 1 FROM ${tcTable} tc
              WHERE tc.${mysql.escapeId("caseNo")} = ${nciRef}
                AND tc.${mysql.escapeId("id")} <> ?
            )`
          );
          whereValues.push(parentId);
        } else {
          whereParts.push(
            `NOT EXISTS (SELECT 1 FROM ${tcTable} tc WHERE tc.${mysql.escapeId("caseNo")} = ${nciRef})`
          );
        }
        appendTransferCaseCasePickerUnitLookupFilter({ user, mysql, mainTableRef: mt, whereParts, whereValues });
      }
      // Public Notice: Case No picker — only open NCI rows and exclude cases already used in another Public Notice parent.
      if (module === "new_case_inward" && listUrl.searchParams.get("public_notice_case_picker") === "1") {
        const finalStatusLabels = (FINAL_CASE_STATUSES || []).map((s) => String(s || "").trim()).filter(Boolean);
        if (finalStatusLabels.length) {
          const placeholders = finalStatusLabels.map(() => "?").join(", ");
          whereParts.push(
            `(
              ${mysql.escapeId("caseStatus")} IS NULL
              OR ${mysql.escapeId("caseStatus")} NOT IN (
                SELECT id
                FROM ${escapeSqlTableIdForModuleConfig(modules.lookup_value_master)}
                WHERE LOWER(TRIM(${mysql.escapeId("lookupValue")})) IN (${placeholders})
              )
            )`
          );
          whereValues.push(...finalStatusLabels.map((v) => v.toLowerCase()));
        }
        const pnTable = escapeSqlTableIdForModuleConfig(modules.public_notice);
        const parentRaw = (listUrl.searchParams.get("public_notice_parent_id") || "").trim();
        const parentId = Number(parentRaw);
        const nciRef = `${mt}.${mysql.escapeId("id")}`;
        if (Number.isFinite(parentId) && parentId > 0) {
          whereParts.push(
            `NOT EXISTS (
              SELECT 1 FROM ${pnTable} pn
              WHERE pn.${mysql.escapeId("caseNo")} = ${nciRef}
                AND pn.${mysql.escapeId("id")} <> ?
            )`
          );
          whereValues.push(parentId);
        } else {
          whereParts.push(
            `NOT EXISTS (SELECT 1 FROM ${pnTable} pn WHERE pn.${mysql.escapeId("caseNo")} = ${nciRef})`
          );
        }
      }
    }

    if (!forLookup) {
      const listScopeAction = canView ? "view" : canEdit ? "edit" : "delete";
      const rowScope = await getScopeForAction(user, module, listScopeAction);
      appendRowScopeFilter(m, user, rowScope, whereParts, whereValues);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    const countSql = `SELECT COUNT(*) AS total FROM ${mt} ${whereSql}`;
    const selectList = buildListSelectClause(m);
    const orderByExpr = buildListOrderByExpr(m, sortBy);
    const dataSql = `SELECT ${selectList} FROM ${mt} ${whereSql} ORDER BY ${orderByExpr} ${sortDir} LIMIT ? OFFSET ?`;

    const [countRows] = await queryWithRetry(countSql, whereValues);
    const total = countRows[0]?.total || 0;
    const [rows] = await queryWithRetry(dataSql, [...whereValues, limit, offset]);

    await enrichLookupDisplayRows(m, rows);

    if (module === "audit_logs" && rows.length) {
      await enrichAuditLogRecordLabels(rows);
    }

    if (!forLookup && rows.length) {
      await annotateRowsModifyAccess(module, m, user, rows, { canEdit, canDelete });
      if (module === "new_case_inward" && Number(user?.role) === 2) {
        const conn = await pool.getConnection();
        try {
          await applyRole2FinalStageEditLock(conn, rows);
        } finally {
          conn.release();
        }
      }
    }

    return Response.json({
      data: rows,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
        sortBy,
        sortDir: sortDir.toLowerCase(),
        filters,
        search: search || undefined
      }
    });
  } catch (error) {
    console.error("CRUD GET error:", error);
    return Response.json({ error: "Failed to load records" }, { status: 500 });
  }
}

/**
 * POST /api/crud/<module> — create a new record.
 *
 * Flow: ensure login → read JSON body **here** (so malformed JSON is caught in this try) →
 * delegate to createCrudRecord in the service → return whatever status/body the service chose.
 *
 * The service handles unknown module, read-only, forbidden, validation errors, and success.
 */
// Create a new row; validation and audit run in crud.service.
export async function POST(req, { params }) {
  try {
    const user = await getRequestUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { module } = await params;
    const raw = await req.json();
    const result = await createCrudRecord(user, module, raw);
    return Response.json(result.body, { status: result.status });
  } catch (error) {
    console.error("CRUD POST error:", error);
    return Response.json({ error: "Failed to create record" }, { status: 500 });
  }
}

