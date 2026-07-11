// Shared library helper for reusable application logic.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Loads child grid rows from the database for one parent id (edit form).
 * Table and column names come only from module config.
 */
import mysql from "mysql2";
import pool from "./db";

/** Rejects table names not declared on the module config (prevents SQL injection). */
function assertChildTableAllowed(moduleConfig, tableName) {
  const t = String(tableName || "").trim();
  const ok = (moduleConfig.childTables || []).some((c) => c.table === t);
  if (!ok) throw new Error(`Invalid child table: ${t}`);
}

/** Converts a DB cell value into the shape the edit form expects (strings for dates, etc.). */
function formatChildFieldForClient(field, value) {
  if (value === null || value === undefined) return field.type === "number" ? "" : "";
  if (field.type === "date") {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, "0");
      const d = String(value.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    const s = String(value);
    return s.length >= 10 ? s.slice(0, 10) : s;
  }
  if (field.type === "number") {
    const n = Number(value);
    return Number.isFinite(n) ? n : "";
  }
  return value;
}

/**
 * @returns {Record<string, Array<Record<string, unknown> & { id: number }>>}
 */
export async function loadChildTableRowsForParent(moduleConfig, parentId) {
  const out = {};
  const numericParentId = Number(parentId);
  if (!Number.isFinite(numericParentId)) return out;

  // Load each configured child grid for this parent id.
  for (const ct of moduleConfig.childTables || []) {
    assertChildTableAllowed(moduleConfig, ct.table);
    const key = ct.key || ct.table;
    const fkField = ct.parentFkField || "parentId";
    const fields = ct.fields || [];
    const fieldNames = fields.map((f) => f.name);
    const selectCols = ["id", ...fieldNames].map((c) => mysql.escapeId(c)).join(", ");
    const [rows] = await pool.query(
      `SELECT ${selectCols} FROM ${mysql.escapeId(ct.table)} WHERE ${mysql.escapeId(
        fkField
      )} = ? ORDER BY ${mysql.escapeId("id")} ASC`,
      [numericParentId]
    );
    out[key] = (rows || []).map((dbRow) => {
      const obj = { id: dbRow.id };
      for (const f of fields) {
        obj[f.name] = formatChildFieldForClient(f, dbRow[f.name]);
      }
      return obj;
    });
  }
  return out;
}


