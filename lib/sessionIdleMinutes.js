// Shared library helper — session timeout for automatic logout.

/**
 * How many minutes of inactivity before the user is logged out.
 * Reads SESSION_IDLE_MINUTES (or NEXT_PUBLIC_SESSION_IDLE_MINUTES); default 20 minutes.
 */

export const SESSION_IDLE_MINUTES_DEFAULT = 20;

/**
 * @param {string | undefined} envValue SESSION_IDLE_MINUTES or NEXT_PUBLIC_SESSION_IDLE_MINUTES
 */
export function resolveSessionIdleMinutes(envValue) {
  const raw = envValue ?? String(SESSION_IDLE_MINUTES_DEFAULT);
  // Clamp between 1 minute and 24 hours so misconfigured env cannot lock users out forever.
  return Math.min(Math.max(parseInt(raw, 10), 1), 24 * 60);
}

