/**
 * =============================================================================
 * CRUD LIST SEARCH & FILTERS — Narrowing down which rows appear in the grid
 * =============================================================================
 * Two common needs:
 * 1) A single search box on the list (“search employees by name”) — we match against
 *    one chosen column on the main table (lookupDisplayField in the module config).
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
import { resolveLookupLabelFieldName } from "./lookupLabelField";

/**
 * Global search from `?search=...` on the list URL.
 *
 * What it does: If the user typed something and the module defines lookupDisplayField
 * (e.g. employee name), add `WHERE thatColumn LIKE '%term%'`.
 *
 * If search is blank or the module has no display field, does nothing.
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
  const colName = String(moduleConfig.lookupDisplayField ?? "").trim();
  if (!colName) return;
  const like = `%${term}%`;
  const col = mysql.escapeId(colName);
  whereParts.push(`${col} LIKE ?`);
  whereValues.push(like);
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
  const trimmed = String(rawValue ?? "").trim();
  if (!trimmed) return;
  const lookup = field.lookup;
  if (!lookup) return;
  const refCfg = modules[lookup.module];
  if (!refCfg?.table) return;

  const searchCol =
    String(lookup.searchField ?? "").trim() || resolveLookupLabelFieldName(lookup);
  if (!searchCol) return;

  const col = mysql.escapeId(fieldName);
  const tb = escapeSqlTableIdForModuleConfig(refCfg);
  const vf = mysql.escapeId(lookup.valueField);
  const sf = mysql.escapeId(searchCol);
  const like = `%${trimmed}%`;
  whereParts.push(`${col} IN (SELECT ${vf} FROM ${tb} WHERE ${sf} LIKE ?)`);
  whereValues.push(like);
}
