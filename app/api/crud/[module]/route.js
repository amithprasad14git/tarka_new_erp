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
import pool from "../../../../lib/db";
import { cookies } from "next/headers";
import { getSessionUser } from "../../../../lib/session";
import { getScopeForAction, hasModulePermission } from "../../../../lib/rbac";
import { appendRowScopeFilter, annotateRowsModifyAccess } from "../../../../lib/rowScope";
import { enrichLookupDisplayRows } from "../../../../lib/crudLookupEnrich";
import { buildListOrderByExpr, buildListSelectClause } from "../../../../lib/crudListSelect";
import mysql from "mysql2";
import { appendGlobalSearchClause, appendLookupFkFilter } from "../../../../lib/crudListSearch";
import { escapeSqlLikePattern } from "../../../../lib/formatViewCellValue";
import { escapeSqlTableIdForModuleConfig } from "../../../../lib/sqlModuleTable";
import { createCrudRecord } from "../../../../lib/services/crud.service";

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
export async function GET(req, { params }) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { module } = await params;
    const m = modules[module];
    if (!m) {
      return Response.json({ error: "Unknown module" }, { status: 404 });
    }

    const canView = await hasModulePermission(user, module, "view");
    const canCreate = await hasModulePermission(user, module, "create");
    const canEdit = await hasModulePermission(user, module, "edit");
    const canDelete = await hasModulePermission(user, module, "delete");
    if (!canView && !canCreate && !canEdit && !canDelete) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { page, limit, sortBy, sortDir, offset, filters, search } = normalizeListQuery(req, m);
    const fieldsByName = Object.fromEntries((m.fields || []).map((f) => [f.name, f]));

    // Create-only (no view / edit / delete): allow the screen to load but do not list rows.
    if (!canView && canCreate && !canEdit && !canDelete) {
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

    const whereParts = [];
    const whereValues = [];

    // Turn each active filter from the URL into SQL (type-aware).
    for (const [key, value] of Object.entries(filters)) {
      if (key.endsWith("_min")) {
        const fieldName = key.replace("f_", "").replace("_min", "");
        const ft = fieldsByName[fieldName]?.type;
        if (ft === "number" || ft === "lookup") {
          const n = Number(value);
          if (!Number.isFinite(n)) continue;
          whereParts.push(`${mysql.escapeId(fieldName)} >= ?`);
          whereValues.push(n);
        }
        continue;
      }
      if (key.endsWith("_max")) {
        const fieldName = key.replace("f_", "").replace("_max", "");
        const ft = fieldsByName[fieldName]?.type;
        if (ft === "number" || ft === "lookup") {
          const n = Number(value);
          if (!Number.isFinite(n)) continue;
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
        appendLookupFkFilter(fieldName, field, value, whereParts, whereValues);
      } else if (field.type === "number") {
        const n = Number(String(value).trim());
        if (!Number.isFinite(n)) continue;
        whereParts.push(`${mysql.escapeId(fieldName)} = ?`);
        whereValues.push(n);
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
    const listUrl = new URL(req.url);
    const forLookup = listUrl.searchParams.get("lov") === "1";

    if (!forLookup) {
      const listScopeAction = canView ? "view" : canEdit ? "edit" : "delete";
      const rowScope = await getScopeForAction(user, module, listScopeAction);
      appendRowScopeFilter(m, user, rowScope, whereParts, whereValues);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
    const mt = escapeSqlTableIdForModuleConfig(m);
    const countSql = `SELECT COUNT(*) AS total FROM ${mt} ${whereSql}`;
    const selectList = buildListSelectClause(m);
    const orderByExpr = buildListOrderByExpr(m, sortBy);
    const dataSql = `SELECT ${selectList} FROM ${mt} ${whereSql} ORDER BY ${orderByExpr} ${sortDir} LIMIT ? OFFSET ?`;

    const [countRows] = await pool.query(countSql, whereValues);
    const total = countRows[0]?.total || 0;
    const [rows] = await pool.query(dataSql, [...whereValues, limit, offset]);

    await enrichLookupDisplayRows(m, rows);

    if (!forLookup && rows.length) {
      await annotateRowsModifyAccess(module, m, user, rows, { canEdit, canDelete });
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
