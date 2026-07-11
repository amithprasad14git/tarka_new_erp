/**
 * =============================================================================
 * SESSION MESSAGES — Client-safe logout / expiry copy
 * =============================================================================
 * Maps internal session-invalid reasons (and `/login?reason=` query values) to
 * the same layman strings used elsewhere in the app. Safe for browser bundles:
 * no DB or Node-only imports — only `apiUserMessages`.
 * =============================================================================
 */

import { apiUserMessage } from "./apiUserMessages";

/**
 * Collapse detailed invalid-session reasons into the two login-page reason codes
 * the UI understands (`replaced` vs generic `expired`).
 * @param {"missing"|"replaced"|"expired"|"inactive_user"|null|undefined} invalidReason
 * @returns {"expired"|"replaced"}
 */
export function sessionLoginReasonForInvalid(invalidReason) {
  if (invalidReason === "replaced") return "replaced";
  return "expired";
}

/**
 * User-facing error text for a server-side session invalid reason.
 * “Replaced” means another login took over this user’s single active session.
 * @param {"missing"|"replaced"|"expired"|"inactive_user"|null|undefined} invalidReason
 * @returns {string}
 */
export function sessionErrorMessageForInvalidReason(invalidReason) {
  if (invalidReason === "replaced") return apiUserMessage("sessionReplaced");
  return apiUserMessage("sessionExpired");
}

/**
 * User-facing error text for `/login?reason=` (redirect after forced logout).
 * Supports inactive account, session replaced, and default expiry messaging.
 * @param {string|undefined|null} loginReason — from `/login?reason=`
 * @returns {string}
 */
export function sessionErrorMessageForLoginReason(loginReason) {
  const r = String(loginReason ?? "")
    .trim()
    .toLowerCase();
  if (r === "inactive") return apiUserMessage("sessionInactive");
  if (r === "replaced") return apiUserMessage("sessionReplaced");
  return apiUserMessage("sessionExpired");
}
