/**
 * Client-safe session logout / expiry messages (no DB or Node-only imports).
 */

import { apiUserMessage } from "./apiUserMessages";

/**
 * @param {"missing"|"replaced"|"expired"|"inactive_user"|null|undefined} invalidReason
 * @returns {"expired"|"replaced"}
 */
export function sessionLoginReasonForInvalid(invalidReason) {
  if (invalidReason === "replaced") return "replaced";
  return "expired";
}

/**
 * @param {"missing"|"replaced"|"expired"|"inactive_user"|null|undefined} invalidReason
 */
export function sessionErrorMessageForInvalidReason(invalidReason) {
  if (invalidReason === "replaced") return apiUserMessage("sessionReplaced");
  return apiUserMessage("sessionExpired");
}

/**
 * @param {string|undefined|null} loginReason — from `/login?reason=`
 */
export function sessionErrorMessageForLoginReason(loginReason) {
  const r = String(loginReason ?? "")
    .trim()
    .toLowerCase();
  if (r === "inactive") return apiUserMessage("sessionInactive");
  if (r === "replaced") return apiUserMessage("sessionReplaced");
  return apiUserMessage("sessionExpired");
}
