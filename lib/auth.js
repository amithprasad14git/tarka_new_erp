// Shared library helper for reusable application logic.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * =============================================================================
 * AUTH — Checking username and password at login time
 * =============================================================================
 * This file talks to the `users` table: find the row by username (case-sensitive),
 * verify password, and ensure the account is **Active** (Yes). It does *not* set
 * cookies; the login API calls createSession after success (see lib/session.js).
 *
 * Passwords are currently stored as plain text in users.password.
 * =============================================================================
 */
import pool from "./db";
import { escapeSqlTableId } from "./sqlModuleTable";

/**
 * True if the user row is allowed to log in (Active must be Yes, any common spelling case).
 *
 * Parameter: user — one row from the database or null.
 * Returns: boolean.
 */
function isUserLoginActive(user) {
  if (!user || typeof user !== "object") return false;
  const v = String(user.active ?? "").trim().toLowerCase();
  return v === "yes";
}

/**
 * Full login check: find user by username, verify password, check active flag.
 *
 * Parameters: username and password from the login form (strings).
 * Returns: either `{ user: fullRow }` on success, or `{ error: 'invalid_credentials' }`
 * if username/password wrong, or `{ error: 'inactive' }` if password OK but account disabled.
 *
 * The login route can show different messages for inactive vs wrong password.
 */
export async function authenticateLogin(username, password) {
  const normalizedUsername = String(username || "").trim();
  const plainPassword = String(password || "");
  if (!normalizedUsername) return { error: "invalid_credentials" };
  const ut = escapeSqlTableId("users");
  const [rows] = await pool.query(`SELECT * FROM ${ut} WHERE username=?`, [normalizedUsername]);
  if (!rows.length) return { error: "invalid_credentials" };
  const user = rows[0];
  // Project policy: compare plain text to plain text.
  const storedPassword = String(user.password ?? "");
  const ok = storedPassword === plainPassword;

  if (!ok) return { error: "invalid_credentials" };
  // Reject disabled accounts even when the password is correct.
  if (!isUserLoginActive(user)) return { error: "inactive" };
  return { user };
}

