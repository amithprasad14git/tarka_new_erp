/**
 * Allowlisted physical MySQL table names for dynamic SQL: every interpolated `FROM` / `INTO` / `JOIN`
 * table identifier must pass {@link assertAllowedTableName}. Names come from `config/modules.js` `table`
 * values plus documented system tables (not exposed as CRUD modules).
 */
import mysql from "mysql2";
import { modules } from "../config/modules";

/** Session store; used by lib/session.js, not a dashboard module. */
const SYSTEM_TABLE_NAMES = new Set(["sessions"]);

const MODULE_TABLE_NAMES = new Set(
  Object.values(modules)
    .map((c) => c?.table)
    .filter((t) => typeof t === "string" && t.length > 0)
);

const ALLOWED_TABLE_NAMES = new Set([...MODULE_TABLE_NAMES, ...SYSTEM_TABLE_NAMES]);

/**
 * @param {string} name Physical table name
 * @returns {string} Same name after validation
 */
export function assertAllowedTableName(name) {
  const n = String(name ?? "").trim();
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
