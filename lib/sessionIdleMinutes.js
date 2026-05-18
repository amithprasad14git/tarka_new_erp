/** Default idle logout window (minutes) when env is unset. */
export const SESSION_IDLE_MINUTES_DEFAULT = 20;

/**
 * @param {string | undefined} envValue SESSION_IDLE_MINUTES or NEXT_PUBLIC_SESSION_IDLE_MINUTES
 */
export function resolveSessionIdleMinutes(envValue) {
  const raw = envValue ?? String(SESSION_IDLE_MINUTES_DEFAULT);
  return Math.min(Math.max(parseInt(raw, 10), 1), 24 * 60);
}
