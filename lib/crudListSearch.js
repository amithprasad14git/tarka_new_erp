// Shared library helper for reusable application logic.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * =============================================================================
 * CRUD LIST SEARCH & FILTERS — Narrowing down which rows appear in the grid
 * =============================================================================
 * Two common needs:
 * 1) A single search box on the list (“search employees by name”) — we match against
 *    columns from `lookupSearchFields` or parsed `lookupDisplayField` (OR + LIKE).
 * 2) Filtering by a lookup column using text — e.g. “show rows whose Unit name contains
 *    Mumbai”. The database stores a numeric unit id, so we translate that into a
 *    subquery against the related table (like looking up a phone book by name to get ids).
 *
 * Both helpers *append* to arrays (whereParts / whereValues) that the route later
 * joins into a full WHERE clause. Think of them as adding sticky notes to the query.
 * =============================================================================
 */
import mysql from "mysql2";
import { modules } from "../config/modules";
import { escapeSqlTableIdForModuleConfig } from "./sqlModuleTable";
import { getModuleGlobalSearchColumns, getRefLookupSearchColumns } from "./lookupLabelField";

/**
 * Global search from `?search=...` on the list URL.
 *
 * Uses `lookupSearchFields` if set; otherwise parses `lookupDisplayField` for
 * `col1 - col2` (real columns only). Multiple columns are OR’d with LIKE.
 *
 * Parameters:
 * - moduleConfig — current module settings.
 * - search — raw string from the query string.
 * - whereParts — string pieces of AND conditions (mutated).
 * - whereValues — placeholder values for `?` in SQL (mutated, same order as ? marks).
 */
export function appendGlobalSearchClause(moduleConfig, search, whereParts, whereValues) {
  const term = String(search || "").trim();
  if (!term) return;
  const like = `%${term}%`;

  const cols = getModuleGlobalSearchColumns(moduleConfig);
  if (!cols.length) return;

  // Single column: simple LIKE; multiple columns: OR together.
  if (cols.length === 1) {
    whereParts.push(`${mysql.escapeId(cols[0])} LIKE ?`);
    whereValues.push(like);
    return;
  }
  const parts = cols.map((c) => `${mysql.escapeId(c)} LIKE ?`);
  whereParts.push(`(${parts.join(" OR ")})`);
  for (let i = 0; i < cols.length; i++) whereValues.push(like);
}

/**
 * Filter on a lookup (foreign key) column when the user types text in a column filter.
 *
 * Example metaphor: The row stores “unit id = 5”. The user types “North” in the unit
 * filter. We find all unit ids whose *name* (or search field) contains “North”, then
 * keep only rows whose unit id is in that set.
 *
 * SQL pattern: fk IN (SELECT id FROM other_table WHERE labelColumn LIKE ?).
 *
 * Parameters:
 * - fieldName — column on the main table (the stored id).
 * - field — field definition from module config (must include lookup.module, etc.).
 * - rawValue — what the user typed.
 * - whereParts, whereValues — same append pattern as above.
 */
export function appendLookupFkFilter(fieldName, field, rawValue, whereParts, whereValues) {
  const trimmed = String(rawValue ?? "")
    .trim()
    .replace(/^%+/, "")
    .replace(/%+$/, "");
  if (!trimmed) return;
  const lookup = field.lookup;
  if (!lookup) return;
  const refCfg = modules[lookup.module];
  if (!refCfg?.table) return;

  const searchCols = getRefLookupSearchColumns(refCfg, lookup);
  if (!searchCols.length) return;

  const col = mysql.escapeId(fieldName);
  const tb = escapeSqlTableIdForModuleConfig(refCfg);
  const vf = mysql.escapeId(lookup.valueField);
  const like = `%${trimmed}%`;

  if (searchCols.length === 1) {
    const sf = mysql.escapeId(searchCols[0]);
    whereParts.push(`${col} IN (SELECT ${vf} FROM ${tb} WHERE ${sf} LIKE ?)`);
    whereValues.push(like);
    return;
  }
  const subParts = searchCols.map((c) => `${mysql.escapeId(c)} LIKE ?`);
  whereParts.push(`${col} IN (SELECT ${vf} FROM ${tb} WHERE (${subParts.join(" OR ")}))`);
  for (let i = 0; i < searchCols.length; i++) whereValues.push(like);
}

