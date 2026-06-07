/**
 * Tests for lib/modules/auditLogs.js
 */

const {
  auditJsonPreview,
  auditJsonFullDisplay,
  AUDIT_JSON_PREVIEW_MAX_CHARS
} = require("../../lib/modules/auditLogs");

// Checks the system records who changed what and shows it in a readable way.
describe("auditLogs.auditJsonPreview", () => {
  it("summarizes JSON objects as changed field names", () => {
    const raw = JSON.stringify({ finalInvoice: "Yes", modifiedDate: "2026-05-16" });
    expect(auditJsonPreview(raw)).toBe("finalInvoice, modifiedDate");
  });

  it("truncates long JSON text", () => {
    const raw = JSON.stringify({
      fieldOne: 1,
      fieldTwo: 2,
      fieldThree: 3,
      fieldFour: 4,
      fieldFive: 5,
      fieldSix: 6
    });
    const preview = auditJsonPreview(raw);
    expect(preview.length).toBeLessThanOrEqual(AUDIT_JSON_PREVIEW_MAX_CHARS + 1);
    expect(preview.endsWith("…")).toBe(true);
  });

  it("truncates long non-object JSON string", () => {
    const raw = "x".repeat(80);
    const preview = auditJsonPreview(raw);
    expect(preview).toHaveLength(AUDIT_JSON_PREVIEW_MAX_CHARS + 1);
    expect(preview.endsWith("…")).toBe(true);
  });

  it("handles parsed object input", () => {
    expect(auditJsonPreview({ invoiceNo: "INV/1" })).toBe("invoiceNo");
  });
});

describe("auditLogs.auditJsonFullDisplay", () => {
  it("pretty-prints full JSON without truncation", () => {
    const raw = JSON.stringify({ finalInvoice: "Yes", modifiedDate: "2026-05-16" });
    expect(auditJsonFullDisplay(raw)).toBe(
      '{\n  "finalInvoice": "Yes",\n  "modifiedDate": "2026-05-16"\n}'
    );
  });

  it("returns empty string for null", () => {
    expect(auditJsonFullDisplay(null)).toBe("");
  });
});
