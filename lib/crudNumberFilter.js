// Shared library helper for reusable application logic.
// Keep module-specific business logic in lib/modules/<module> files.

import mysql from "mysql2";
import { parseNumericCellValue } from "./formatInrNumber";
import { escapeSqlLikePattern } from "./sqlLikeEscape";

/** IDs, flags, and integer-only fields use exact integer match. */
export function shouldUseExactNumberColumnFilter(field) {
  if (!field || field.type !== "number") return false;
  if (field.integerOnly) return true;
  const name = String(field.name || "");
  if (name === "role" || name === "record_id" || name === "sequence") return true;
  if (/^can_(view|create|edit|delete)$/.test(name)) return true;
  if (name === "is_active" || name === "active") return true;
  return false;
}

/**
 * View-grid number column filter on the stored column (no charge recalculation).
 * - Flags / IDs: exact match
 * - Amounts: partial digit match (filter 100 matches 1000 and 100000; commas stripped first)
 */
export function appendNumberColumnFilter(fieldName, field, rawValue, whereParts, whereValues) {
  const normalized = String(rawValue ?? "")
    .replace(/,/g, "")
    .trim();
  if (!normalized) return;

  const col = mysql.escapeId(fieldName);

  if (shouldUseExactNumberColumnFilter(field)) {
    const n = parseNumericCellValue(normalized);
    if (n == null) return;
    whereParts.push(`${col} = ?`);
    whereValues.push(field.integerOnly ? Math.trunc(n) : n);
    return;
  }

  if (!/^-?\d*\.?\d*$/.test(normalized)) return;

  const needle = escapeSqlLikePattern(normalized);
  whereParts.push(`CAST(${col} AS CHAR) LIKE ? ESCAPE '\\\\'`);
  whereValues.push(`%${needle}%`);
}
