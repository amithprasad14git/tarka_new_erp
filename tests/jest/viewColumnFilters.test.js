/**
 * Tests for lib/viewColumnFilters.js
 */

const {
  COLUMN_FILTER_DEBOUNCE_MS,
  stripEmptyFilters,
  normalizeCommittedFromInput,
  columnFiltersEqual,
  hasUncommittedColumnFilters,
  hasAnyColumnFilterValue
} = require("../../lib/viewColumnFilters");

describe("viewColumnFilters", () => {
  test("COLUMN_FILTER_DEBOUNCE_MS is 1200", () => {
    expect(COLUMN_FILTER_DEBOUNCE_MS).toBe(1200);
  });

  test("stripEmptyFilters removes empty and whitespace keys", () => {
    expect(stripEmptyFilters({ a: "x", b: "", c: "  ", d: "y" })).toEqual({ a: "x", d: "y" });
  });

  test("normalizeCommittedFromInput strips empty keys and trims values", () => {
    expect(
      normalizeCommittedFromInput({
        recoveryInvoice: "",
        sarfaesiInvoice: "  bar  "
      })
    ).toEqual({ sarfaesiInvoice: "bar" });
  });

  test("stale recovery cleared before sarfaesi filter commits", () => {
    const draft = { recoveryInvoice: "", sarfaesiInvoice: "bar" };
    expect(normalizeCommittedFromInput(draft)).toEqual({ sarfaesiInvoice: "bar" });
  });

  test("columnFiltersEqual ignores whitespace and empty keys", () => {
    expect(columnFiltersEqual({ foo: "  bar " }, { foo: "bar", baz: "" })).toBe(true);
    expect(columnFiltersEqual({ foo: "bar" }, { foo: "baz" })).toBe(false);
  });

  test("hasUncommittedColumnFilters detects draft vs committed mismatch", () => {
    expect(hasUncommittedColumnFilters({ foo: "draft" }, { foo: "committed" })).toBe(true);
    expect(hasUncommittedColumnFilters({ foo: "same" }, { foo: "same" })).toBe(false);
  });

  test("hasAnyColumnFilterValue checks draft or committed", () => {
    expect(hasAnyColumnFilterValue({}, { foo: "x" })).toBe(true);
    expect(hasAnyColumnFilterValue({ foo: "x" }, {})).toBe(true);
    expect(hasAnyColumnFilterValue({}, {})).toBe(false);
    expect(hasAnyColumnFilterValue({ foo: "" }, { bar: "  " })).toBe(false);
  });
});
