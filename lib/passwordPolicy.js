// Shared password policy for change-password (client + server).

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_ALLOWED_SPECIAL_CHARS = "@#$%&*";

export const PASSWORD_POLICY_HELPER_TEXT =
  'At least 8 characters, including one number and one special character (@ # $ % & *). Cannot contain the word "password" or your username.';

const ALLOWED_SPECIAL_REGEX = /[@#$%&*]/;
const DIGIT_REGEX = /\d/;

/**
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
