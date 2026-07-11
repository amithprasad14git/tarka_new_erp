// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `crudNormalize`.
 * Run with: npm test
 */

// Test file for validating app behavior and regression safety.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Comprehensive tests for lib/crudNormalize.js
 */

const { normalizeCrudPayload } = require("../../lib/crudNormalize");

// Helper used by tests: moduleConfig.
function moduleConfig() {
  return {
    fields: [
      { name: "name", type: "text" },
      { name: "amount", type: "number" },
      { name: "entrustmentDate", type: "date" },
      { name: "npaDate", type: "date" },
      {
        name: "branch",
        type: "lookup",
        lookup: { module: "branch_master", valueField: "id" }
      },
      { name: "loanType", type: "lookup" } // no lookup object => should not normalize as lookup
    ]
  };
}

// Checks incoming form data is cleaned and rejected when rules are broken.
describe("crudNormalize.normalizeCrudPayload", () => {
  test("empty string to null conversion for date and lookup", () => {
    const input = {
      entrustmentDate: "",
      branch: ""
    };
    const out = normalizeCrudPayload(input, moduleConfig());
    expect(out.entrustmentDate).toBeNull();
    expect(out.branch).toBeNull();
  });

  test("date field normalization: whitespace string becomes null", () => {
    const out = normalizeCrudPayload({ entrustmentDate: "   " }, moduleConfig());
    expect(out.entrustmentDate).toBeNull();
  });

  test("date field normalization: valid date string is preserved", () => {
    const out = normalizeCrudPayload({ entrustmentDate: "2026-04-10" }, moduleConfig());
    expect(out.entrustmentDate).toBe("2026-04-10");
  });

  test("lookup field normalization: non-empty lookup converts to Number", () => {
    const out = normalizeCrudPayload({ branch: "123" }, moduleConfig());
    expect(out.branch).toBe(123);
    expect(typeof out.branch).toBe("number");
  });

  test("lookup field normalization: zero becomes null", () => {
    expect(normalizeCrudPayload({ branch: 0 }, moduleConfig()).branch).toBeNull();
    expect(normalizeCrudPayload({ branch: "0" }, moduleConfig()).branch).toBeNull();
  });

  test("numeric field preservation: number fields are unchanged by normalizer", () => {
    const out = normalizeCrudPayload({ amount: "123.45" }, moduleConfig());
    expect(out.amount).toBe("123.45");
  });

  test("non-empty string preservation for text fields", () => {
    const out = normalizeCrudPayload({ name: "John Doe" }, moduleConfig());
    expect(out.name).toBe("John Doe");
  });

  test("null passthrough: explicit null on date and lookup remains null", () => {
    const out = normalizeCrudPayload({ entrustmentDate: null, branch: null }, moduleConfig());
    expect(out.entrustmentDate).toBeNull();
    expect(out.branch).toBeNull();
  });

  test("undefined field handling: missing keys are left untouched", () => {
    const input = { name: "A" };
    const out = normalizeCrudPayload(input, moduleConfig());
    expect(Object.prototype.hasOwnProperty.call(out, "entrustmentDate")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(out, "branch")).toBe(false);
    expect(out.name).toBe("A");
  });

  test("undefined value handling: provided undefined becomes null for date and lookup", () => {
    const out = normalizeCrudPayload({ entrustmentDate: undefined, branch: undefined }, moduleConfig());
    expect(out.entrustmentDate).toBeNull();
    expect(out.branch).toBeNull();
  });

  test("mixed payload normalization", () => {
    const out = normalizeCrudPayload(
      {
        name: "Borrower A",
        amount: 999,
        entrustmentDate: "2026-04-01",
        npaDate: " ",
        branch: "45",
        loanType: "5",
        extraField: "keep-me"
      },
      moduleConfig()
    );

    expect(out).toEqual({
      name: "Borrower A",
      amount: 999,
      entrustmentDate: "2026-04-01",
      npaDate: null,
      branch: 45,
      loanType: "5",
      extraField: "keep-me"
    });
  });
});



