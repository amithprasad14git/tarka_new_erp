/**
 * =============================================================================
 * CRUD LIST — Building the SELECT and ORDER BY parts of “show me a table of rows”
 * =============================================================================
 * When the app shows a paged grid (list of employees, units, etc.), the server
 * must build SQL that:
 * - Lists the right columns (not always SELECT * — dates may be formatted for display).
 * - Sorts by a real database column so sorting by date still makes chronological sense
 *   even when the displayed date is a pretty string (like dd-mm-yyyy with AM/PM).
 *
 * This file does not run queries by itself; it only returns pieces of SQL text that
 * the CRUD route combines with WHERE, LIMIT, etc.
 * =============================================================================
 */
import mysql from "mysql2";
import { escapeSqlTableIdForModuleConfig } from "./sqlModuleTable";

// These audit columns are shown in a human-friendly datetime format in list APIs.
const DATE_FORMAT_AUDIT_DATES = new Set(["createdDate", "modifiedDate"]);

// MySQL date_format pattern: day-month-year and 12-hour clock with AM/PM.
const AUDIT_DATETIME_FORMAT = "%d-%m-%Y %h:%i %p";

/**
 * Builds the comma-separated column list for SELECT in the list endpoint.
 *
 * Why it exists: Some columns need DATE_FORMAT so JSON responses look consistent;
 * raw database timestamps can shift time zones when converted automatically.
 *
 * What it does:
 * - Always includes `id` if the module config forgot to list it (every row needs an id).
 * - For createdDate/modifiedDate: format as readable datetime string with an alias.
 * - For type "date": format as YYYY-MM-DD string only (calendar date, no time confusion).
 * - Other columns: table.column as-is.
 *
 * Parameters: moduleConfig — one module from config/modules.js.
 * Returns: a string fragment like "`employees`.`id`, `employees`.`name`, ..."
 */
export function buildListSelectClause(moduleConfig) {
  const tb = escapeSqlTableIdForModuleConfig(moduleConfig);
  const fields = moduleConfig.fields || [];
  const names = new Set(fields.map((f) => f.name));
  const parts = [];

  if (!names.has("id")) {
    parts.push(`${tb}.${mysql.escapeId("id")}`);
  }

  for (const f of fields) {
    const col = mysql.escapeId(f.name);
    if (DATE_FORMAT_AUDIT_DATES.has(f.name)) {
      parts.push(`DATE_FORMAT(${tb}.${col}, '${AUDIT_DATETIME_FORMAT}') AS ${col}`);
    } else if (f.type === "date") {
      // Calendar date only (no time/zone); avoids mysql2 Date → JSON ISO shift in list rows.
      parts.push(`DATE_FORMAT(${tb}.${col}, '%Y-%m-%d') AS ${col}`);
    } else {
      parts.push(`${tb}.${col}`);
    }
  }

  return parts.join(", ");
}

/**
 * Builds the ORDER BY expression (table.column) for the requested sort column.
 *
 * Why not sort by the display alias? If we sorted by the formatted date string,
 * alphabetical order would not match real chronological order. So we ORDER BY
 * the underlying real column on the table.
 *
 * Parameters:
 * - moduleConfig — which table we are listing.
 * - sortBy — column name (already whitelisted by the API route against module fields).
 *
 * Returns: SQL fragment like "`employees`.`name`" (properly escaped).
 */
export function buildListOrderByExpr(moduleConfig, sortBy) {
  const tb = escapeSqlTableIdForModuleConfig(moduleConfig);
  const col = mysql.escapeId(sortBy);
  return `${tb}.${col}`;
}
