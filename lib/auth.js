/**
 * =============================================================================
 * AUTH — Checking email and password at login time
 * =============================================================================
 * This file talks to the `users` table: find the row by email, verify password,
 * and ensure the account is **Active** (Yes). It does *not* set cookies; the login
 * API calls createSession after success (see lib/session.js).
 *
 * Passwords are normally stored hashed (bcrypt). A legacy fallback compares plain
 * text only if bcrypt fails and a stored password exists — for old seed data.
 * =============================================================================
 */
import bcrypt from "bcryptjs";
import pool from "./db";
import { escapeSqlTableId } from "./sqlModuleTable";

/**
 * True if the user row is allowed to log in (Active must be Yes, any common spelling case).
 *
 * Parameter: user — one row from the database or null.
 * Returns: boolean.
 */
export function isUserLoginActive(user) {
  if (!user || typeof user !== "object") return false;
  const v = String(user.active ?? "").trim().toLowerCase();
  return v === "yes";
}

/**
 * Full login check: find user by email, verify password, check active flag.
 *
 * Parameters: email and password from the login form (strings).
 * Returns: either `{ user: fullRow }` on success, or `{ error: 'invalid_credentials' }`
 * if email/password wrong, or `{ error: 'inactive' }` if password OK but account disabled.
 *
 * The login route can show different messages for inactive vs wrong password.
 */
export async function authenticateLogin(email, password) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const plainPassword = String(password || "");
  const ut = escapeSqlTableId("users");
  const [rows] = await pool.query(`SELECT * FROM ${ut} WHERE LOWER(email)=?`, [normalizedEmail]);
  if (!rows.length) return { error: "invalid_credentials" };
  const user = rows[0];
  const storedPassword = user.password ?? user.password_hash ?? "";
  let ok = false;
  try {
    ok = bcrypt.compareSync(plainPassword, storedPassword);
  } catch {
    ok = false;
  }

  if (!ok && storedPassword) {
    ok = storedPassword === plainPassword;
  }

  if (!ok) return { error: "invalid_credentials" };
  if (!isUserLoginActive(user)) return { error: "inactive" };
  return { user };
}

/**
 * Simpler wrapper: returns the user object or null (does not distinguish inactive vs wrong password).
 *
 * Useful when you only need “logged in or not” without a specific error reason.
 */
export async function verifyUser(email, password) {
  const r = await authenticateLogin(email, password);
  return "user" in r ? r.user : null;
}
