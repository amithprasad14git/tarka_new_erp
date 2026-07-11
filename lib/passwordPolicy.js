/**
 * =============================================================================
 * PASSWORD POLICY — Shared rules for change-password (client + server)
 * =============================================================================
 * Keeps browser validation and API validation in sync: minimum length, digit,
 * allowed special characters, and bans on the word “password” or the username.
 * Helper text is shown under the new-password field in the UI.
 * =============================================================================
 */

/** Minimum length required for a new password. */
export const PASSWORD_MIN_LENGTH = 8;

/** Special characters accepted by the policy (shown in helper text). */
export const PASSWORD_ALLOWED_SPECIAL_CHARS = "@#$%&*";

/** Short policy summary for forms (must stay aligned with validateNewPassword). */
export const PASSWORD_POLICY_HELPER_TEXT =
  'At least 8 characters, including one number and one special character (@ # $ % & *). Cannot contain the word "password" or your username.';

const ALLOWED_SPECIAL_REGEX = /[@#$%&*]/;
const DIGIT_REGEX = /\d/;

/**
 * Validate a proposed new password against the shared policy.
 * Returns the first failing rule as a user-facing string, or null when valid.
 * Pass `username` so the password cannot embed the account name.
 * @param {string} password
 * @param {{ username?: string }} [options]
 * @returns {string | null} Error message, or null when valid.
 */
export function validateNewPassword(password, { username = "" } = {}) {
  const value = String(password ?? "");

  if (!value) {
    return "New password is required.";
  }
  if (value.length < PASSWORD_MIN_LENGTH) {
    return "New password must be at least 8 characters.";
  }
  if (!DIGIT_REGEX.test(value)) {
    return "New password must include at least one number.";
  }
  if (!ALLOWED_SPECIAL_REGEX.test(value)) {
    return "New password must include at least one special character (@ # $ % & *).";
  }
  if (value.toLowerCase().includes("password")) {
    return 'New password cannot contain the word "password".';
  }

  const normalizedUsername = String(username ?? "").trim();
  if (normalizedUsername && value.toLowerCase().includes(normalizedUsername.toLowerCase())) {
    return "New password cannot contain your username.";
  }

  return null;
}
