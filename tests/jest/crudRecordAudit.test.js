// Test file for validating app behavior and regression safety.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Comprehensive tests for lib/crudRecordAudit.js (strip behavior focused)
 */

jest.mock("../../lib/istDateTime", () => ({
  formatInstantAsMysqlDatetimeIST: jest.fn(() => "2026-04-26 15:30:00")
}));

const {
  DEFAULT_AUDIT_COLUMNS,
  getAuditColumnNames,
  moduleHasRowAuditFields,
  stripClientAuditFields,
  applyCreateAudit,
  applyUpdateAudit
} = require("../../lib/crudRecordAudit");

describe("crudRecordAudit.stripClientAuditFields", () => {
  test("strips created_by", () => {
    const out = stripClientAuditFields({ name: "A", created_by: 1 });
    expect(out).toEqual({ name: "A" });
  });

  test("strips updated_by", () => {
    const out = stripClientAuditFields({ name: "A", updated_by: 2 });
    expect(out).toEqual({ name: "A" });
  });

  test("strips created_at", () => {
    const out = stripClientAuditFields({ name: "A", created_at: "2026-01-01" });
    expect(out).toEqual({ name: "A" });
  });

  test("strips updated_at", () => {
    const out = stripClientAuditFields({ name: "A", updated_at: "2026-01-02" });
    expect(out).toEqual({ name: "A" });
  });

  test("preserves valid business fields", () => {
    const out = stripClientAuditFields({
      name: "Borrower",
      amount: 1000,
      remarks: "ok",
      active: "Yes"
    });
    expect(out).toEqual({
      name: "Borrower",
      amount: 1000,
      remarks: "ok",
      active: "Yes"
    });
  });

  test("handles null payload", () => {
    const out = stripClientAuditFields(null);
    expect(out).toEqual({});
  });

  test("handles empty payload", () => {
    const out = stripClientAuditFields({});
    expect(out).toEqual({});
  });

  test("also strips camelCase and modified_* aliases", () => {
    const out = stripClientAuditFields({
      createdBy: 1,
      createdDate: "2026-01-01",
      modifiedBy: 2,
      modifiedDate: "2026-01-02",
      modified_by: 3,
      modified_at: "2026-01-03",
      business: "keep"
    });
    expect(out).toEqual({ business: "keep" });
  });
});

describe("crudRecordAudit column mapping and row-audit detection", () => {
  test("default audit column names are exposed", () => {
    expect(DEFAULT_AUDIT_COLUMNS).toEqual({
      createdBy: "createdBy",
      createdAt: "createdDate",
      modifiedBy: "modifiedBy",
      modifiedAt: "modifiedDate"
    });
  });

  test("getAuditColumnNames returns defaults when no override", () => {
    expect(getAuditColumnNames({})).toEqual(DEFAULT_AUDIT_COLUMNS);
    expect(getAuditColumnNames(null)).toEqual(DEFAULT_AUDIT_COLUMNS);
  });

  test("getAuditColumnNames applies module override mapping", () => {
    const cfg = {
      auditColumns: {
        createdBy: "created_by",
        createdAt: "created_at",
        modifiedBy: "updated_by",
        modifiedAt: "updated_at"
      }
    };
    expect(getAuditColumnNames(cfg)).toEqual({
      createdBy: "created_by",
      createdAt: "created_at",
      modifiedBy: "updated_by",
      modifiedAt: "updated_at"
    });
  });

  test("moduleHasRowAuditFields true when all four fields exist", () => {
    const cfg = {
      fields: [
        { name: "createdBy" },
        { name: "createdDate" },
        { name: "modifiedBy" },
        { name: "modifiedDate" }
      ]
    };
    expect(moduleHasRowAuditFields(cfg)).toBe(true);
  });

  test("moduleHasRowAuditFields false when any audit field missing", () => {
    const cfg = {
      fields: [{ name: "createdBy" }, { name: "createdDate" }, { name: "modifiedBy" }]
    };
    expect(moduleHasRowAuditFields(cfg)).toBe(false);
    expect(moduleHasRowAuditFields({ fields: [] })).toBe(false);
  });
});

describe("crudRecordAudit apply stamps", () => {
  test("applyCreateAudit stamps creator + modifier + timestamps", () => {
    const cols = {
      createdBy: "createdBy",
      createdAt: "createdDate",
      modifiedBy: "modifiedBy",
      modifiedAt: "modifiedDate"
    };
    const out = applyCreateAudit({ name: "A" }, 99, cols);
    expect(out).toEqual({
      name: "A",
      createdBy: 99,
      createdDate: "2026-04-26 15:30:00",
      modifiedBy: 99,
      modifiedDate: "2026-04-26 15:30:00"
    });
  });

  test("applyUpdateAudit stamps only modifier + modified timestamp", () => {
    const cols = {
      createdBy: "createdBy",
      createdAt: "createdDate",
      modifiedBy: "modifiedBy",
      modifiedAt: "modifiedDate"
    };
    const out = applyUpdateAudit({ name: "B", createdBy: 1, createdDate: "old" }, 99, cols);
    expect(out).toEqual({
      name: "B",
      createdBy: 1,
      createdDate: "old",
      modifiedBy: 99,
      modifiedDate: "2026-04-26 15:30:00"
    });
  });
});

