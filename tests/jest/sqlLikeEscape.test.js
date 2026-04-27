/**
 * Comprehensive tests for lib/sqlLikeEscape.js
 */

const { escapeSqlLikePattern } = require("../../lib/sqlLikeEscape");

describe("sqlLikeEscape.escapeSqlLikePattern", () => {
  test("percent escaping", () => {
    expect(escapeSqlLikePattern("100%")).toBe("100\\%");
    expect(escapeSqlLikePattern("%abc%")).toBe("\\%abc\\%");
  });

  test("underscore escaping", () => {
    expect(escapeSqlLikePattern("a_b")).toBe("a\\_b");
    expect(escapeSqlLikePattern("__")).toBe("\\_\\_");
  });

  test("backslash escaping", () => {
    expect(escapeSqlLikePattern("\\")).toBe("\\\\");
    expect(escapeSqlLikePattern("a\\b")).toBe("a\\\\b");
  });

  test("mixed wildcard escaping", () => {
    expect(escapeSqlLikePattern("x%_\\y")).toBe("x\\%\\_\\\\y");
    expect(escapeSqlLikePattern("%_\\%_")).toBe("\\%\\_\\\\\\%\\_");
  });

  test("empty string", () => {
    expect(escapeSqlLikePattern("")).toBe("");
  });

  test("null input", () => {
    expect(escapeSqlLikePattern(null)).toBe("");
  });

  test("undefined input", () => {
    expect(escapeSqlLikePattern(undefined)).toBe("");
  });
});

