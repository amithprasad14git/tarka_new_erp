/**
 * Shared JSON error responses for API routes — layman `error` + optional DB `hint`.
 */

import { getDbErrorHint } from "./dbConnectionError";
import { apiUserMessage } from "./apiUserMessages";

/**
 * @param {unknown} error
 * @returns {boolean}
 */
export function isDbOrNetworkError(error) {
  return Boolean(getDbErrorHint(error));
}

/**
 * Pick layman message; use *Db variant when we have a database/connectivity hint.
 * @param {keyof import("./apiUserMessages.js").API_USER_MESSAGES} baseKey
 * @param {unknown} error
 */
export function laymanMessageForError(baseKey, error) {
  const dbKey = `${String(baseKey)}Db`;
  if (isDbOrNetworkError(error) && apiUserMessage(dbKey) !== apiUserMessage("genericServer")) {
    return apiUserMessage(dbKey);
  }
  return apiUserMessage(baseKey);
}

/**
 * @param {unknown} error
 * @param {{ laymanMessage: string, status?: number, logLabel?: string }} options
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
 * @param {unknown} error
 * @param {keyof import("./apiUserMessages.js").API_USER_MESSAGES} messageKey
 * @param {{ status?: number, logLabel?: string }} [options]
 */
export function jsonApiErrorForAction(error, messageKey, options = {}) {
  const { status = 500, logLabel = "API error" } = options;
  return jsonApiError(error, {
    laymanMessage: laymanMessageForError(messageKey, error),
    status,
    logLabel
  });
}
