/**
 * users — business rules when login accounts are created or updated.
 * Form fields and labels: config/modules.js
 */

import mysql from "mysql2";
import { modules } from "../../config/modules";
import { escapeSqlTableId } from "../sqlModuleTable";

function throwUsersValidation(message) {
  throw Object.assign(new Error(message), { code: "USERS_VALIDATION_FAILED" });
}

/**
 * Trim username, require non-empty, enforce case-sensitive uniqueness.
 *
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {{ merged: object, oldRow?: object | null, recordId?: number | null }} ctx
 */
export async function applyUsersBeforeWrite(conn, { merged, oldRow, recordId = null }) {
  const effective = oldRow ? { ...oldRow, ...merged } : merged;
  const username = String(effective?.username ?? "").trim();
  if (!username) {
    throwUsersValidation("Username is required.");
  }
  merged.username = username;

  const table = modules.users?.table;
  if (!table) {
    throwUsersValidation("users module config missing.");
  }
  const ut = escapeSqlTableId(table);
  const idCol = mysql.escapeId("id");
  const usernameCol = mysql.escapeId("username");
  const excludeId = Number(recordId ?? effective?.id);
  const exclude = Number.isFinite(excludeId) && excludeId > 0 ? excludeId : 0;

  const [rows] = await conn.query(
    `SELECT ${idCol} FROM ${ut} WHERE ${usernameCol} = ? AND ${idCol} <> ? LIMIT 1`,
    [username, exclude]
  );
  if (rows?.length) {
    throwUsersValidation("Username is already in use.");
  }
}
