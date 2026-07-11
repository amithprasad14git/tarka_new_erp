/**
 * =============================================================================
 * API ERROR RESPONSE — Shared JSON errors for Route Handlers
 * =============================================================================
 * API routes should return short, layman-friendly `error` text (and optional DB
 * `hint`) instead of raw exception messages. This module picks the right message
 * key, logs technical detail server-side, and builds a consistent Response.
 * Session 401 helpers are re-exported from sessionAuthResponse for one import.
 * =============================================================================
 */

import { getDbErrorHint } from "./dbConnectionError";
import { apiUserMessage } from "./apiUserMessages";

export {
  jsonUnauthorizedForSession,
  unauthorizedSessionPayload
} from "./sessionAuthResponse";

/**
 * True when the failure looks like DB/connectivity (so we can swap in *Db messages).
 * @param {unknown} error
 * @returns {boolean}
 */
export function isDbOrNetworkError(error) {
  return Boolean(getDbErrorHint(error));
}

/**
 * Pick layman message; use *Db variant when we have a database/connectivity hint.
 * Keeps operators informed without exposing SQL or stack traces in the JSON body.
 * @param {keyof import("./apiUserMessages.js").API_USER_MESSAGES} baseKey
 * @param {unknown} error
 * @returns {string}
 */
export function laymanMessageForError(baseKey, error) {
  const dbKey = `${String(baseKey)}Db`;
  if (isDbOrNetworkError(error) && apiUserMessage(dbKey) !== apiUserMessage("genericServer")) {
    return apiUserMessage(dbKey);
  }
  return apiUserMessage(baseKey);
}

/**
 * Build a JSON error Response: layman `error`, optional DB `hint`, and server log.
 * Prefer this over ad-hoc `Response.json({ error: err.message })` in routes.
 * @param {unknown} error
 * @param {{ laymanMessage: string, status?: number, logLabel?: string }} options
 * @returns {Response}
 */
export function jsonApiError(error, { laymanMessage, status = 500, logLabel = "API error" }) {
  const hint = getDbErrorHint(error) ?? null;
  console.error(logLabel + ":", {
    message: error?.message ?? String(error),
    code: error?.code,
    errno: error?.errno,
    sqlState: error?.sqlState,
    sqlMessage: error?.sqlMessage
  });
  return Response.json(
    {
      error: laymanMessage,
      ...(hint ? { hint } : {})
    },
    { status }
  );
}

/**
 * Convenience: map an action message key + thrown error to a JSON error Response.
 * Chooses base vs *Db layman text automatically from the error shape.
 * @param {unknown} error
 * @param {keyof import("./apiUserMessages.js").API_USER_MESSAGES} messageKey
 * @param {{ status?: number, logLabel?: string }} [options]
 * @returns {Response}
 */
export function jsonApiErrorForAction(error, messageKey, options = {}) {
  const { status = 500, logLabel = "API error" } = options;
  return jsonApiError(error, {
    laymanMessage: laymanMessageForError(messageKey, error),
    status,
    logLabel
  });
}
