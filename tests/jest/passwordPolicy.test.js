// Test file — automated checks so changes do not break existing behaviour.

const { validateNewPassword } = require("../../lib/passwordPolicy");

describe("passwordPolicy", () => {
  test("accepts a password that meets all rules", () => {
    expect(validateNewPassword("Secure9@key")).toBeNull();
  });

  test("rejects empty password", () => {
    expect(validateNewPassword("")).toBe("New password is required.");
  });

  test("rejects password shorter than 8 characters", () => {
    expect(validateNewPassword("Sec9@")).toBe("New password must be at least 8 characters.");
  });

  test("rejects password without a digit", () => {
    expect(validateNewPassword("Secure@key")).toBe("New password must include at least one number.");
  });

  test("rejects password without an allowed special character", () => {
    expect(validateNewPassword("Secure9key")).toBe(
      "New password must include at least one special character (@ # $ % & *)."
    );
  });

  test("rejects password with disallowed special only", () => {
    expect(validateNewPassword("Secure9!key")).toBe(
      "New password must include at least one special character (@ # $ % & *)."
    );
  });

  test('rejects password containing the word "password"', () => {
    expect(validateNewPassword("MyPassword1@")).toBe('New password cannot contain the word "password".');
  });

  test("rejects password containing username", () => {
    expect(validateNewPassword("john.admin9@", { username: "john.admin" })).toBe(
      "New password cannot contain your username."
    );
  });

  test("username check is case-insensitive", () => {
    expect(validateNewPassword("JOHN.ADMIN9@", { username: "john.admin" })).toBe(
      "New password cannot contain your username."
    );
  });
});
