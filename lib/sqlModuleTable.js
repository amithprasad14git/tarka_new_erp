// Shared library helper for reusable application logic.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Allowlisted physical MySQL table names for dynamic SQL: every interpolated `FROM` / `INTO` / `JOIN`
 * table identifier must pass {@link assertAllowedTableName}. Names come from `config/modules.js` `table`
 * values plus documented system tables (not exposed as CRUD modules).
 */
import mysql from "mysql2";
import { modules } from "../config/modules";

/**
 * Tables the app talks to that are not full CRUD “modules” in the menu.
 * - sessions: login persistence
 * - module_number_sequence: stored counters for reference numbers (e.g. Case No prefixes)
 */
const SYSTEM_TABLE_NAMES = new Set(["sessions", "module_number_sequence"]);

const MODULE_TABLE_NAMES = new Set(
  Object.values(modules)
    .map((c) => c?.table)
    .filter((t) => typeof t === "string" && t.length > 0)
);

/** Child tables referenced in `config/modules.js` `childTables[].table` (not top-level module keys). */
const CHILD_TABLE_NAMES = new Set();
for (const c of Object.values(modules)) {
  const childTables = c?.childTables;
  if (!Array.isArray(childTables)) continue;
  for (const ct of childTables) {
    const t = ct?.table;
    if (typeof t === "string" && t.length > 0) CHILD_TABLE_NAMES.add(t);
  }
}

const ALLOWED_TABLE_NAMES = new Set([...MODULE_TABLE_NAMES, ...CHILD_TABLE_NAMES, ...SYSTEM_TABLE_NAMES]);

/**
 * @param {string} name Physical table name
 * @returns {string} Same name after validation
 */
export function assertAllowedTableName(name) {
  const n = String(name ?? "").trim();
  // Only tables declared in modules config or the small system allowlist may appear in SQL.
  if (!n || !ALLOWED_TABLE_NAMES.has(n)) {
    throw new Error(`Disallowed or unknown SQL table name: ${n || "(empty)"}`);
  }
  return n;
}

/** Backtick-escaped identifier for an allowlisted table name. */
export function escapeSqlTableId(name) {
  return mysql.escapeId(assertAllowedTableName(name));
}

/**
 * @param {string} moduleKey Key in config/modules.js
 */
export function tableNameFromModuleKey(moduleKey) {
  const cfg = modules[moduleKey];
  if (!cfg?.table) {
    throw new Error(`Unknown module key: ${String(moduleKey ?? "")}`);
  }
  return assertAllowedTableName(cfg.table);
}

export function escapeSqlTableIdForModuleKey(moduleKey) {
  return mysql.escapeId(tableNameFromModuleKey(moduleKey));
}

/**
 * @param {{ table?: string }} moduleConfig From modules[key]
 */
export function tableNameFromModuleConfig(moduleConfig) {
  if (!moduleConfig?.table) {
    throw new Error("Module config missing table");
  }
  return assertAllowedTableName(moduleConfig.table);
}

export function escapeSqlTableIdForModuleConfig(moduleConfig) {
  return mysql.escapeId(tableNameFromModuleConfig(moduleConfig));
}


