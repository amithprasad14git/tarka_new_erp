// Test file for validating app behavior and regression safety.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Comprehensive tests for lib/permissionScope.js
 */

const { normalizeActionScope, actionScopesFromDbRow } = require("../../lib/permissionScope");

describe("permissionScope.normalizeActionScope", () => {
  test("own normalization", () => {
    expect(normalizeActionScope("own")).toBe("own");
  });

  test("unit normalization", () => {
    expect(normalizeActionScope("unit")).toBe("unit");
  });

  test("all normalization", () => {
    expect(normalizeActionScope("all")).toBe("all");
  });

  test("uppercase input normalization", () => {
    expect(normalizeActionScope("OWN")).toBe("own");
    expect(normalizeActionScope(" Unit ")).toBe("unit");
    expect(normalizeActionScope("ALL")).toBe("all");
  });

  test("invalid scope fallback", () => {
    expect(normalizeActionScope("team")).toBe("all");
    expect(normalizeActionScope("123")).toBe("all");
  });

  test("null input handling", () => {
    expect(normalizeActionScope(null)).toBe("all");
  });

  test("undefined input handling", () => {
    expect(normalizeActionScope(undefined)).toBe("all");
  });

  test("empty string handling", () => {
    expect(normalizeActionScope("")).toBe("all");
    expect(normalizeActionScope("   ")).toBe("all");
  });
});

describe("permissionScope.actionScopesFromDbRow", () => {
  test("returns all scopes as all for null row", () => {
    expect(actionScopesFromDbRow(null)).toEqual({
      view_scope: "all",
      edit_scope: "all",
      delete_scope: "all"
    });
  });

  test("normalizes per-action values from row", () => {
    expect(
      actionScopesFromDbRow({
        view_scope: "OWN",
        edit_scope: " unit ",
        delete_scope: "all"
      })
    ).toEqual({
      view_scope: "own",
      edit_scope: "unit",
      delete_scope: "all"
    });
  });

  test("falls back to all for invalid / empty row values", () => {
    expect(
      actionScopesFromDbRow({
        view_scope: "bad",
        edit_scope: "",
        delete_scope: undefined
      })
    ).toEqual({
      view_scope: "all",
      edit_scope: "all",
      delete_scope: "all"
    });
  });
});

