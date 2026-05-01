// Test file for validating app behavior and regression safety.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Comprehensive tests for lib/services/crudPayloadValidation.js
 */

const { validateCrudPayloadForWrite } = require("../../lib/services/crudPayloadValidation");

function makeModuleConfig() {
  return {
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "email", label: "Email", type: "email", required: false },
      { name: "amount", label: "Amount", type: "number", required: true },
      { name: "startDate", label: "Start Date", type: "date", required: false },
      {
        name: "status",
        label: "Status",
        type: "select",
        required: false,
        options: [
          { label: "Open", value: "open" },
          { label: "Closed", value: "closed" }
        ]
      },
      {
        name: "unit",
        label: "Unit",
        type: "lookup",
        required: false,
        lookup: { module: "unit_master", valueField: "id" }
      },
      { name: "meta", label: "Meta", type: "json", required: false },
      { name: "createdBy", label: "Created By", type: "lookup", excludeFromForm: true }
    ]
  };
}

describe("crudPayloadValidation.validateCrudPayloadForWrite", () => {
  describe("required field validation", () => {
    test("create: rejects when required field is missing", () => {
      const config = makeModuleConfig();
      const err = validateCrudPayloadForWrite(config, { amount: 100 }, "create", ["amount"]);
      expect(err).toBe("Name is required.");
    });

    test("create: rejects when required field is empty string", () => {
      const config = makeModuleConfig();
      const err = validateCrudPayloadForWrite(config, { name: " ", amount: 100 }, "create", ["name", "amount"]);
      expect(err).toBe("Name is required.");
    });

    test("update: rejects when required field is explicitly emptied", () => {
      const config = makeModuleConfig();
      const err = validateCrudPayloadForWrite(config, { name: "" }, "update", ["name"]);
      expect(err).toBe("Name cannot be empty.");
    });
  });

  describe("email validation", () => {
    test("accepts valid email", () => {
      const config = makeModuleConfig();
      const err = validateCrudPayloadForWrite(
        config,
        { name: "A", amount: 1, email: "a@test.com" },
        "create",
        ["name", "amount", "email"]
      );
      expect(err).toBeNull();
    });

    test("rejects invalid email", () => {
      const config = makeModuleConfig();
      const err = validateCrudPayloadForWrite(
        config,
        { name: "A", amount: 1, email: "bad-email" },
        "create",
        ["name", "amount", "email"]
      );
      expect(err).toBe('"Email" must be a valid email address.');
    });
  });

  describe("numeric validation", () => {
    test("accepts numeric values and numeric strings", () => {
      const config = makeModuleConfig();
      const err = validateCrudPayloadForWrite(config, { name: "A", amount: "100.50" }, "create", ["name", "amount"]);
      expect(err).toBeNull();
    });

    test("rejects non-numeric value", () => {
      const config = makeModuleConfig();
      const err = validateCrudPayloadForWrite(config, { name: "A", amount: "ten" }, "create", ["name", "amount"]);
      // Current validator treats non-numeric required number as empty -> required message.
      expect(err).toBe("Amount is required.");
    });
  });

  describe("date format and calendar validation", () => {
    test("accepts valid YYYY-MM-DD", () => {
      const config = makeModuleConfig();
      const err = validateCrudPayloadForWrite(
        config,
        { name: "A", amount: 1, startDate: "2026-04-30" },
        "create",
        ["name", "amount", "startDate"]
      );
      expect(err).toBeNull();
    });

    test("rejects invalid date format", () => {
      const config = makeModuleConfig();
      const err = validateCrudPayloadForWrite(
        config,
        { name: "A", amount: 1, startDate: "30-04-2026" },
        "create",
        ["name", "amount", "startDate"]
      );
      expect(err).toBe('"Start Date" must be a date in YYYY-MM-DD format.');
    });

    test("rejects invalid calendar date", () => {
      const config = makeModuleConfig();
      const err = validateCrudPayloadForWrite(
        config,
        { name: "A", amount: 1, startDate: "2026-02-30" },
        "create",
        ["name", "amount", "startDate"]
      );
      expect(err).toBe('"Start Date" must be a date in YYYY-MM-DD format.');
    });
  });

  describe("select and lookup validation", () => {
    test("rejects select value outside allowed options", () => {
      const config = makeModuleConfig();
      const err = validateCrudPayloadForWrite(
        config,
        { name: "A", amount: 1, status: "pending" },
        "create",
        ["name", "amount", "status"]
      );
      expect(err).toBe('"Status" must be one of the allowed options.');
    });

    test("accepts select value by string equivalence", () => {
      const config = makeModuleConfig();
      const err = validateCrudPayloadForWrite(
        config,
        { name: "A", amount: 1, status: "closed" },
        "create",
        ["name", "amount", "status"]
      );
      expect(err).toBeNull();
    });

    test("lookup optional non-numeric value is treated as empty and allowed", () => {
      const config = makeModuleConfig();
      const err = validateCrudPayloadForWrite(
        config,
        { name: "A", amount: 1, unit: "abc" },
        "create",
        ["name", "amount", "unit"]
      );
      expect(err).toBeNull();
    });

    test("lookup validation accepts numeric id", () => {
      const config = makeModuleConfig();
      const err = validateCrudPayloadForWrite(
        config,
        { name: "A", amount: 1, unit: "12" },
        "create",
        ["name", "amount", "unit"]
      );
      expect(err).toBeNull();
    });
  });

  describe("null handling and empty-string behavior", () => {
    test("create: optional empty values are allowed/ignored for validation", () => {
      const config = makeModuleConfig();
      const err = validateCrudPayloadForWrite(
        config,
        { name: "A", amount: 1, email: "", startDate: "", status: "", unit: "" },
        "create",
        ["name", "amount", "email", "startDate", "status", "unit"]
      );
      expect(err).toBeNull();
    });

    test("update: optional field cleared to empty is allowed", () => {
      const config = makeModuleConfig();
      const err = validateCrudPayloadForWrite(config, { email: "" }, "update", ["email"]);
      expect(err).toBeNull();
    });

    test("create: required numeric field null is rejected", () => {
      const config = makeModuleConfig();
      const err = validateCrudPayloadForWrite(config, { name: "A", amount: null }, "create", ["name", "amount"]);
      expect(err).toBe("Amount is required.");
    });
  });

  describe("invalid module config / malformed payload / unknown fields", () => {
    test("invalid module config (missing fields) does not crash and does not validate unknown keys", () => {
      const err = validateCrudPayloadForWrite({}, { any: "value" }, "update", ["any"]);
      expect(err).toBeNull();
    });

    test("unknown field in payload is ignored (current behavior)", () => {
      const config = makeModuleConfig();
      const err = validateCrudPayloadForWrite(config, { name: "A", amount: 1, unknownField: "x" }, "create", [
        "name",
        "amount",
        "unknownField"
      ]);
      expect(err).toBeNull();
    });

    test("malformed payload object for text field is rejected", () => {
      const config = makeModuleConfig();
      const err = validateCrudPayloadForWrite(config, { name: { bad: true }, amount: 1 }, "create", ["name", "amount"]);
      expect(err).toBe('Invalid value for "Name".');
    });

    test("excludeFromForm field is ignored even if provided", () => {
      const config = makeModuleConfig();
      const err = validateCrudPayloadForWrite(
        config,
        { name: "A", amount: 1, createdBy: "not-a-number" },
        "create",
        ["name", "amount", "createdBy"]
      );
      expect(err).toBeNull();
    });

    test("unknown/custom field type falls through as valid (covers default branches)", () => {
      const config = makeModuleConfig();
      const err = validateCrudPayloadForWrite(
        config,
        { name: "A", amount: 1, meta: "" },
        "create",
        ["name", "amount", "meta"]
      );
      expect(err).toBeNull();
    });

    test("update mode runs format validation for non-empty value and returns error", () => {
      const config = makeModuleConfig();
      const err = validateCrudPayloadForWrite(config, { email: "bad-email" }, "update", ["email"]);
      expect(err).toBe('"Email" must be a valid email address.');
    });
  });
});

