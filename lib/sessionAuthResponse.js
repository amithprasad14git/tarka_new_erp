/**
 * Layman 401 JSON for invalid sessions (no next/headers).
 */

import { apiUserMessage } from "./apiUserMessages";
import { getSessionInvalidReason } from "./session";
import {
  sessionErrorMessageForInvalidReason,
  sessionLoginReasonForInvalid
} from "./sessionMessages";

/**
 * Layman 401 body when the session cookie is missing or no longer valid.
 * @param {string|undefined|null} sessionId
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
 * @param {string|undefined|null} sessionId
 */
export async function jsonUnauthorizedForSession(sessionId) {
  const body = await unauthorizedSessionPayload(sessionId);
  return Response.json(body, { status: 401 });
}
