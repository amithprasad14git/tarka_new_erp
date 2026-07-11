// Shared library helper for reusable application logic.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Persists `childTableRows` from CRUD payloads into configured child tables.
 * Table and column identifiers come only from module config (never from the client).
 * syncMode per child table: replace (default) | append | serverOnly
 */
import mysql from "mysql2";

/** @param {{ childTables?: Array<{ table: string }> }} moduleConfig */
function assertChildTableAllowed(moduleConfig, tableName) {
  const t = String(tableName || "").trim();
  const ok = (moduleConfig.childTables || []).some((c) => c.table === t);
  if (!ok) {
    throw Object.assign(new Error(`Invalid child table: ${t}`), { code: "CHILD_ROWS_INVALID" });
  }
}

function normalizeSyncMode(ct) {
  const m = String(ct?.syncMode || "replace").trim().toLowerCase();
  if (m === "append") return "append";
  if (m === "serveronly" || m === "server_only") return "serverOnly";
  return "replace";
}

/**
 * @param {{ fields?: Array<{ name: string, type?: string, required?: boolean, label?: string, excludeFromForm?: boolean }> }} ct
 * @param {Record<string, unknown>} row
 * @param {number} rowIndex
 * @returns {string | null} error message or null
 */
function validateChildTableRow(ct, row, rowIndex) {
  const label = ct.label || ct.key || ct.table || "Line";
  for (const f of ct.fields || []) {
    if (f.excludeFromForm) continue;
    const v = row[f.name];
    const empty = v === "" || v === undefined || v === null;
    if (f.required && empty) {
      return `${label}, row ${rowIndex + 1}: ${f.label || f.name} is required.`;
    }
    if (!empty && f.type === "number") {
      const n = Number(v);
      if (!Number.isFinite(n)) {
        return `${label}, row ${rowIndex + 1}: ${f.label || f.name} must be a valid number.`;
      }
    }
    if (!empty && f.type === "checkbox") {
      const n = Number(v === true ? 1 : v === false ? 0 : v);
      if (n !== 0 && n !== 1) {
        return `${label}, row ${rowIndex + 1}: ${f.label || f.name} must be 0 or 1.`;
      }
    }
  }
  return null;
}

/**
 * @param {{ fields?: Array<{ name: string, type?: string }> }} ct
 * @param {string} fieldName
 * @param {unknown} v
 */
function coerceChildValue(ct, fieldName, v) {
  const field = (ct.fields || []).find((f) => f.name === fieldName);
  const type = field?.type;
  if (type === "checkbox") {
    if (v === true) return 1;
    if (v === false) return 0;
    if (v === "" || v === undefined || v === null) return 0;
    const n = Number(v);
    if (n === 1) return 1;
    if (n === 0) return 0;
    return null;
  }
  if (v === "" || v === undefined) return null;
  if (type === "number") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (type === "lookup") {
    return v === null ? null : Number(v);
  }
  return v;
}

function rowHasPersistedId(row) {
  const id = row?.id;
  return id != null && String(id).trim() !== "" && Number.isFinite(Number(id)) && Number(id) > 0;
}

async function insertChildRow(conn, ct, parentId, row, fieldNames, fkField) {
  const tableId = mysql.escapeId(ct.table);
  const cols = [fkField, ...fieldNames];
  const escapedCols = cols.map((c) => mysql.escapeId(c));
  const placeholders = cols.map(() => "?").join(", ");
  const values = [parentId, ...fieldNames.map((name) => coerceChildValue(ct, name, row[name]))];
  await conn.query(
    `INSERT INTO ${tableId} (${escapedCols.join(", ")}) VALUES (${placeholders})`,
    values
  );
}

/**
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {{ childTables?: unknown[] }} moduleConfig
 * @param {number} parentId
 * @param {Record<string, unknown[]> | null | undefined} childTableRows
 */
export async function syncChildTablesInTransaction(conn, moduleConfig, parentId, childTableRows) {
  const children = moduleConfig.childTables;
  if (!children?.length) return;
  if (childTableRows == null || typeof childTableRows !== "object") return;

  for (const ct of children) {
    const tableKey = ct.key || ct.table;
    const rows = childTableRows[tableKey];
    if (rows === undefined) continue;
    if (!Array.isArray(rows)) {
      throw Object.assign(new Error("Invalid child row payload"), { code: "CHILD_ROWS_INVALID" });
    }

    const syncMode = normalizeSyncMode(ct);
    if (syncMode === "serverOnly") continue;

    assertChildTableAllowed(moduleConfig, ct.table);
    const fkField = ct.parentFkField || "parentId";
    const tableId = mysql.escapeId(ct.table);
    const fkId = mysql.escapeId(fkField);
    const fieldNames = (ct.fields || []).filter((f) => !f.excludeFromForm).map((f) => f.name);

    if (syncMode === "replace") {
      await conn.query(`DELETE FROM ${tableId} WHERE ${fkId} = ?`, [parentId]);

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || typeof row !== "object") {
          throw Object.assign(new Error("Invalid child row payload"), { code: "CHILD_ROWS_INVALID" });
        }
        const err = validateChildTableRow(ct, row, i);
        if (err) {
          throw Object.assign(new Error(err), { code: "CHILD_ROWS_INVALID" });
        }
        await insertChildRow(conn, ct, parentId, row, fieldNames, fkField);
      }
      continue;
    }

    if (syncMode === "append") {
      let newIndex = 0;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || typeof row !== "object") {
          throw Object.assign(new Error("Invalid child row payload"), { code: "CHILD_ROWS_INVALID" });
        }
        if (rowHasPersistedId(row)) continue;
        const textField = row.commentText != null ? String(row.commentText).trim() : "";
        if (fieldNames.includes("commentText") && !textField) continue;
        const err = validateChildTableRow(ct, row, newIndex);
        if (err) {
          throw Object.assign(new Error(err), { code: "CHILD_ROWS_INVALID" });
        }
        await insertChildRow(conn, ct, parentId, row, fieldNames, fkField);
        newIndex += 1;
      }
    }
  }
}

/**
 * Removes all child rows linked to a parent (used on parent DELETE).
 * Runs for every configured child table, including syncMode serverOnly.
 *
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {{ childTables?: unknown[] }} moduleConfig
 * @param {number} parentId
 */
export async function deleteChildTablesForParent(conn, moduleConfig, parentId) {
  const children = moduleConfig.childTables;
  if (!children?.length) return;

  for (const ct of children) {
    assertChildTableAllowed(moduleConfig, ct.table);
    const fkField = ct.parentFkField || "parentId";
    const tableId = mysql.escapeId(ct.table);
    const fkId = mysql.escapeId(fkField);
    await conn.query(`DELETE FROM ${tableId} WHERE ${fkId} = ?`, [parentId]);
  }
}

