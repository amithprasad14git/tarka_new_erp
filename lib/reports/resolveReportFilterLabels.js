// Shared report helper — lookup filter ids to display labels for report header.

/**
 * Resolves lookup filter ids to display text for buildFilterSummary.
 * Client may pass filterLabels JSON on /api/reports/.../run to skip server LoV queries.
 */

import mysql from "mysql2";
import pool from "../db";
import { modules } from "../../config/modules";
import { escapeSqlTableIdForModuleConfig } from "../sqlModuleTable";
import { buildLookupLabelSqlExpression } from "../lookupLabelFieldSql";
import { resolveLookupDisplayParts } from "../lookupLabelField";

/**
 * @param {object} reportConfig
 * @param {Record<string, string>} filters
 * @param {Record<string, string>} [clientLabels] Labels from the filter form when available
 * @returns {Promise<Record<string, string>>}
 */
export async function resolveReportFilterLabels(reportConfig, filters, clientLabels = {}) {
  const out = { ...(clientLabels || {}) };

  for (const field of reportConfig?.fields || []) {
    if (field.type !== "lookup") continue;
    const raw = filters[field.name];
    if (raw == null || String(raw).trim() === "" || !Number.isFinite(Number(raw))) continue;
    if (out[field.name] && String(out[field.name]).trim()) continue;

    const lookup = field.lookup;
    const refKey = String(lookup?.module || "").trim();
    const refCfg = refKey ? modules[refKey] : null;
    const displayCols = resolveLookupDisplayParts(lookup);
    if (!refCfg?.table || !displayCols.length) continue;

    const labelExpr = buildLookupLabelSqlExpression(displayCols);
    if (!labelExpr) continue;

    const vf = String(lookup.valueField || "id").trim();
    const tb = escapeSqlTableIdForModuleConfig(refCfg);
    const vfCol = mysql.escapeId(vf);

    const [rows] = await pool.query(
      `SELECT ${labelExpr} AS lf FROM ${tb} WHERE ${vfCol} = ? LIMIT 1`,
      [raw]
    );
    const lf = rows?.[0]?.lf;
    if (lf != null && String(lf).trim() !== "") {
      out[field.name] = String(lf).trim();
    }
  }

  return out;
}

