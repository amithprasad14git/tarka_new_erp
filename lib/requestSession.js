/**
 * =============================================================================
 * REQUEST SESSION — Who is calling this API route?
 * =============================================================================
 * Next.js Route Handlers receive a Web `Request`. Session identity lives in the
 * `session` cookie. This module reads that cookie from the Request Cookie header
 * (not `next/headers`) so it stays safe to import from plain `lib/` code, then
 * resolves the logged-in user — or a ready-made 401 Response when auth fails.
 * =============================================================================
 */

import { jsonUnauthorizedForSession } from "./sessionAuthResponse";
import { getSessionUser } from "./session";

/**
 * Extract the session id from the Request Cookie header.
 * Decodes URI-encoded cookie values when possible so the id matches the DB row.
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
 * Resolve session cookie + current user for an API request.
 * Returns both so callers can distinguish “no cookie” from “cookie but invalid user”.
 * @param {Request|{ headers?: { get?: (name: string) => string | null } }|null|undefined} req
 * @returns {Promise<{ sid: string|undefined, user: object|null }>}
 */
export async function getRequestSession(req) {
  const sid = sessionIdFromRequest(req);
  const user = await getSessionUser(sid);
  return { sid, user };
}

/**
 * Require a logged-in user for an API route; otherwise return a layman 401 Response.
 * Prefer this at the top of protected handlers so business logic never runs unauthenticated.
 * On unexpected errors, still returns 401 (does not leak internals).
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
