/**
 * =============================================================================
 * LOOKUP ENRICH — Turn “id numbers” into readable names on list rows
 * =============================================================================
 * Lists often store a foreign key (e.g. unit = 3). The grid still needs to show
 * “Unit: North Branch” without the user memorizing ids. After the main query returns
 * rows, this file batches extra database reads: for each lookup field, collect all ids
 * appearing on the page, fetch labels from the related table in one query, then
 * attach a friendly string on each row (e.g. unitLabel).
 *
 * Think of it as a mail-merge step after the main envelope list is printed.
 * =============================================================================
 */
import mysql from "mysql2";
import pool from "./db";
import { modules } from "../config/modules";
import { escapeSqlTableIdForModuleConfig } from "./sqlModuleTable";
import { getLookupRowLabelKey, resolveLookupDisplayParts } from "./lookupLabelField";
import { buildLookupLabelSqlExpression } from "./lookupLabelFieldSql";

/**
 * For each lookup field on the module, fills in a display label on every row.
 *
 * Parameters:
 * - moduleConfig — defines which fields are lookups and where they point.
 * - rows — array of row objects from the list query (modified in place).
 *
 * Returns: the same rows array (for chaining). Safe no-op if no rows or no lookups.
 *
 * Edge cases: Skips lookups missing config; skips if no ids collected; uses empty
 * string when a label cannot be found (orphan id).
 */
export async function enrichLookupDisplayRows(moduleConfig, rows) {
  if (!rows?.length) return rows;
  const fields = moduleConfig.fields || [];
  const lookups = fields.filter(
    (f) => f.type === "lookup" && f.lookup && resolveLookupDisplayParts(f.lookup).length
  );
  if (!lookups.length) return rows;

  for (const field of lookups) {
    const { module: refKey, valueField } = field.lookup;
    const displayCols = resolveLookupDisplayParts(field.lookup);
    const refCfg = modules[refKey];
    if (!refCfg?.table || !displayCols.length) continue;

    const labelExpr = buildLookupLabelSqlExpression(displayCols);
    if (!labelExpr) continue;

    const rowKey = getLookupRowLabelKey(field);
    if (!rowKey) continue;

    const ids = [
      ...new Set(
        rows.map((r) => r[field.name]).filter((id) => id != null && id !== "")
      )
    ];
    if (!ids.length) continue;

    const ph = ids.map(() => "?").join(",");
    const vf = mysql.escapeId(valueField);
    const tb = escapeSqlTableIdForModuleConfig(refCfg);
    const [refRows] = await pool.query(
      `SELECT ${vf} AS vf, ${labelExpr} AS lf FROM ${tb} WHERE ${vf} IN (${ph})`,
      ids
    );
    const map = Object.fromEntries(refRows.map((r) => [String(r.vf), r.lf]));
    for (const row of rows) {
      const id = row[field.name];
      row[rowKey] = map[String(id)] ?? "";
    }
  }
  return rows;
}
