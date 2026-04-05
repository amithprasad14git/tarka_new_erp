/**
 * =============================================================================
 * SESSIONS — Keeping someone “logged in” safely on the server
 * =============================================================================
 * After login, the browser holds a random session id in an httpOnly cookie (the app
 * name is usually "session"). The server stores that id in table `sessions` with the
 * user id and an expiry time. On each request, we look up the session; if valid, we
 * load the user and optionally extend the expiry (“sliding window”) so active users
 * are not kicked out too soon.
 *
 * Idle length is controlled by environment variable SESSION_IDLE_MINUTES (capped at 24h).
 *
 * If the user’s account is no longer Active = Yes, getSessionUser returns null so
 * they must log in again — even if the session row still exists.
 * =============================================================================
 */
import { randomUUID } from "crypto";
import pool from "./db";
import { escapeSqlTableId } from "./sqlModuleTable";

// How long a session stays valid after last activity (minutes). Read from env with safe min/max.
const IDLE_MINUTES = Math.min(
  Math.max(parseInt(process.env.SESSION_IDLE_MINUTES || "10", 10), 1),
  24 * 60
);

/**
 * Creates a new session in the database and returns its random id string.
 * That id is what gets stored in the cookie; the password is never put in the cookie.
 *
 * Parameter: userId — numeric id from users table.
 * Returns: Promise<string> session id (UUID).
 */
export async function createSession(userId) {
  const id = randomUUID();
  const st = escapeSqlTableId("sessions");
  await pool.query(
    `INSERT INTO ${st} (id, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
    [id, userId, IDLE_MINUTES]
  );
  return id;
}

/**
 * Pushes the session’s expiry time forward if the session is still alive.
 * Called after successful user resolution so browsing the app extends the deadline.
 *
 * Parameter: sessionId — from cookie; undefined does nothing.
 */
export async function refreshSessionExpiry(sessionId) {
  if (!sessionId) return;
  // Update expiry only if the session hasn't expired yet.
  const st = escapeSqlTableId("sessions");
  await pool.query(
    `UPDATE ${st} SET expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id=? AND expires_at > NOW()`,
    [IDLE_MINUTES, sessionId]
  );
}

/**
 * Loads the raw session row (id, user_id, expires_at) if not expired.
 * Most code uses getSessionUser instead; this is lower-level.
 */
export async function getSession(id) {
  if (!id) return null;
  // Only return the session row if it hasn't expired.
  const st = escapeSqlTableId("sessions");
  const [rows] = await pool.query(
    `SELECT * FROM ${st} WHERE id=? AND expires_at > NOW()`,
    [id]
  );
  return rows[0];
}

/**
 * Logout: deletes the session row so the cookie no longer refers to a valid login.
 */
export async function deleteSession(id) {
  if (!id) return;
  // Safe no-op if `id` is undefined.
  const st = escapeSqlTableId("sessions");
  await pool.query(`DELETE FROM ${st} WHERE id=?`, [id]);
}

/**
 * The main helper API routes use: from cookie session id → small user object (id, email, role, unit).
 *
 * Joins sessions to users, requires active = Yes, refreshes sliding expiry on success.
 * Returns null if cookie missing, session expired, or user inactive.
 */
export async function getSessionUser(id) {
  if (!id) return null;
  // Join `sessions` -> `users` so UI/client never directly handles user ids from cookie.
  const st = escapeSqlTableId("sessions");
  const ut = escapeSqlTableId("users");
  const [rows] = await pool.query(
    `SELECT u.id, u.email, u.role, u.unit
     FROM ${st} s
     JOIN ${ut} u ON u.id = s.user_id
     WHERE s.id=? AND s.expires_at > NOW()
       AND LOWER(TRIM(COALESCE(u.active, ''))) = 'yes'
     LIMIT 1`,
    [id]
  );
  const user = rows[0] || null;
  if (user) {
    // Sliding expiration: extend on every successful request.
    await refreshSessionExpiry(id);
  }
  return user;
}
