/**
 * HTTP handler for `/api/new-case-inward/entry-lookups`.
 * Business rules live in lib/modules; this file loads data and returns JSON or files.
 */

// Application route/page/API handler for this feature area.
// Keep module-specific business logic in lib/modules/<module> files.

import mysql from "mysql2";
import { cookies } from "next/headers";
import { modules } from "../../../../config/modules";
import pool from "../../../../lib/db";
import { resolveLookupDisplayParts } from "../../../../lib/lookupLabelField";
import { buildLookupLabelSqlExpression } from "../../../../lib/lookupLabelFieldSql";
import { hasModulePermission } from "../../../../lib/rbac";
import { getSessionUser } from "../../../../lib/session";
import { escapeSqlTableIdForModuleConfig } from "../../../../lib/sqlModuleTable";
import { jsonApiErrorForAction, jsonUnauthorizedForSession } from "../../../../lib/apiErrorResponse";

// Shape SQL rows into { id, _label } objects the NCI form dropdowns expect.
function sanitizeLookupRows(rows, valueField) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    [valueField]: row?.vf,
    _label: String(row?.lf ?? "").trim()
  }));
}

/**
 * Module-specific preload endpoint for New Case Inward form lookups.
 * It returns one payload keyed by field name so entry/edit screens can avoid
 * many per-field LoV API calls while preserving dropdown UX.
 */
// Preload all NCI lookup dropdowns in one call (faster than many ?lov=1 requests).
export async function GET() {
  try {
    // Must be logged in and allowed to open the NCI screen.
    const cookieStore = await cookies();
    const sid = cookieStore.get("session")?.value;
    const user = await getSessionUser(sid);
    if (!user) return await jsonUnauthorizedForSession(sid);

    const moduleKey = "new_case_inward";
    const [canView, canCreate, canEdit] = await Promise.all([
      hasModulePermission(user, moduleKey, "view"),
      hasModulePermission(user, moduleKey, "create"),
      hasModulePermission(user, moduleKey, "edit")
    ]);
    if (!canView && !canCreate && !canEdit) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const nciCfg = modules.new_case_inward;
    const lookupFields = (nciCfg?.fields || []).filter((f) => f.type === "lookup" && f.lookup?.module);
    const payload = {};

    // One query per lookup field defined on new_case_inward in modules.js.
    for (const field of lookupFields) {
      const lookup = field.lookup || {};
      const refCfg = modules[lookup.module];
      if (!refCfg?.table) {
        payload[field.name] = [];
        continue;
      }
      const valueField = String(lookup.valueField || "id").trim();
      const displayParts = resolveLookupDisplayParts(lookup);
      const labelExpr = buildLookupLabelSqlExpression(displayParts);
      if (!labelExpr) {
        payload[field.name] = [];
        continue;
      }

      const tb = escapeSqlTableIdForModuleConfig(refCfg);
      const vf = mysql.escapeId(valueField);
      let sql = `SELECT ${vf} AS vf, ${labelExpr} AS lf FROM ${tb}`;
      const values = [];
      if (String(lookup.module || "").trim() === "lookup_value_master") {
        // Match generic LoV behavior: each NCI field can request values from one lookup type.
        const filterName = String(lookup.filterLookupTypeName || "").trim();
        const filterIdRaw = String(lookup.filterLookupType || "").trim();
        if (filterName) {
          const ltm = modules.lookup_type_master;
          if (ltm?.table) {
            const subTable = escapeSqlTableIdForModuleConfig(ltm);
            sql += ` WHERE ${mysql.escapeId("lookupType")} IN (SELECT id FROM ${subTable} WHERE LOWER(TRIM(lookupType)) = LOWER(TRIM(?)))`;
            values.push(filterName);
          }
        } else if (filterIdRaw) {
          const filterId = Number(filterIdRaw);
          if (Number.isFinite(filterId)) {
            sql += ` WHERE ${mysql.escapeId("lookupType")} = ?`;
            values.push(filterId);
          }
        }
      }
      // Honor `lookup.extraLovParams` from config/modules (e.g. f_active=Yes). NCI dropdowns preload here
      // instead of /api/crud?lov=1, so this must mirror CRUD LoV filters for those keys.
      const wantActiveYes =
        String(lookup.extraLovParams?.f_active ?? "")
          .trim()
          .toLowerCase() === "yes";
      if (wantActiveYes) {
        const activeCol = mysql.escapeId("active");
        if (/\bWHERE\b/i.test(sql)) {
          sql += ` AND TRIM(COALESCE(${activeCol}, '')) = ?`;
        } else {
          sql += ` WHERE TRIM(COALESCE(${activeCol}, '')) = ?`;
        }
        values.push("Yes");
      }
      sql += " ORDER BY lf ASC LIMIT 500";
      const [rows] = await pool.query(sql, values);
      payload[field.name] = sanitizeLookupRows(rows, valueField);
    }

    return Response.json({ data: payload });
  } catch (error) {
    return jsonApiErrorForAction(error, "loadNciLookups", { logLabel: "NCI entry lookups API" });
  }
}


