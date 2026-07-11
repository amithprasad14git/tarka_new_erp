/**
 * =============================================================================
 * SESSION AUTH RESPONSE — Layman 401 JSON for bad/missing sessions
 * =============================================================================
 * When an API call has no valid session, clients need a clear reason (expired,
 * replaced on another device, etc.) without technical jargon. This module builds
 * that payload and wraps it as HTTP 401 — without importing `next/headers`, so
 * it can be used from shared `lib/` helpers.
 * =============================================================================
 */

import { apiUserMessage } from "./apiUserMessages";
import { getSessionInvalidReason } from "./session";
import {
  sessionErrorMessageForInvalidReason,
  sessionLoginReasonForInvalid
} from "./sessionMessages";

/**
 * Layman 401 body when the session cookie is missing or no longer valid.
 * Looks up why the session failed so the UI can show the right sign-in message.
 * @param {string|undefined|null} sessionId
 * @returns {Promise<{ error: string, reason: string }>}
 */
export async function unauthorizedSessionPayload(sessionId) {
  try {
    const invalidReason = await getSessionInvalidReason(sessionId);
    return {
      error: sessionErrorMessageForInvalidReason(invalidReason),
      reason: sessionLoginReasonForInvalid(invalidReason)
    };
  } catch (error) {
    console.error("unauthorizedSessionPayload:", error?.message ?? error);
    return {
      error: apiUserMessage("sessionExpired"),
      reason: "expired"
    };
  }
}

/**
 * HTTP 401 JSON Response for an invalid or missing session cookie.
 * Use from API routes / request helpers when the caller must sign in again.
 * @param {string|undefined|null} sessionId
 * @returns {Promise<Response>}
 */
export async function jsonUnauthorizedForSession(sessionId) {
  const body = await unauthorizedSessionPayload(sessionId);
  return Response.json(body, { status: 401 });
}
