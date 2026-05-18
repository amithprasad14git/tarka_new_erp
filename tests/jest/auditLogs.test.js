/**
 * Tests for lib/modules/auditLogs.js
 */

const { auditJsonPreview, AUDIT_JSON_PREVIEW_MAX_CHARS } = require("../../lib/modules/auditLogs");

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
