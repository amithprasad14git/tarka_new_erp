/**
 * Read session cookie + resolve user for API Route Handlers.
 * Uses Request Cookie header (not next/headers) so this module is safe in lib/.
 */

import { jsonUnauthorizedForSession } from "./sessionAuthResponse";
import { getSessionUser } from "./session";

/**
 * @param {Request|{ headers?: { get?: (name: string) => string | null } }|null|undefined} req
 * @returns {string|undefined}
 */
export function sessionIdFromRequest(req) {
  const header = String(req?.headers?.get?.("cookie") || "");
  const match = /(?:^|;\s*)session=([^;]*)/.exec(header);
  if (!match) return undefined;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * @param {Request|{ headers?: { get?: (name: string) => string | null } }|null|undefined} req
 */
export async function getRequestSession(req) {
  const sid = sessionIdFromRequest(req);
  const user = await getSessionUser(sid);
  return { sid, user };
}

/**
 * @param {Request|{ headers?: { get?: (name: string) => string | null } }|null|undefined} req
 * @returns {Promise<{ user: object, unauthorized: null } | { user: null, unauthorized: Response }>}
 */
export async function requireRequestUser(req) {
  try {
    const { sid, user } = await getRequestSession(req);
    if (!user) {
      return { user: null, unauthorized: await jsonUnauthorizedForSession(sid) };
    }
    return { user, unauthorized: null };
  } catch (error) {
    console.error("requireRequestUser:", error?.message ?? error);
    return { user: null, unauthorized: await jsonUnauthorizedForSession(undefined) };
  }
}
