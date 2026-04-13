/**
 * Server-only: uses mysql2 for identifier escaping. Do not import from client components.
 */
import mysql from "mysql2";

/**
 * SQL expression (no table prefix) for the lookup label, for use as `... AS lf`.
 */
export function buildLookupLabelSqlExpression(columnNames) {
  if (!columnNames?.length) return null;
  if (columnNames.length === 1) {
    return mysql.escapeId(columnNames[0]);
  }
  const esc = columnNames.map((c) => mysql.escapeId(c));
  return `CONCAT_WS(' - ', ${esc.join(", ")})`;
}
