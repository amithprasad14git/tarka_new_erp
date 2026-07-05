/**
 * Tests for lib/formatAuditDateTime.js
 */

const { formatAuditDateTimeDisplay } = require("../../lib/formatAuditDateTime");

describe("formatAuditDateTimeDisplay", () => {
  test("formats MySQL datetime as dd-mm-yyyy h:mm AM/PM", () => {
    expect(formatAuditDateTimeDisplay("2026-07-03 17:30:45")).toBe("03-07-2026 5:30 PM");
    expect(formatAuditDateTimeDisplay("2026-07-03 09:05:00")).toBe("03-07-2026 9:05 AM");
    expect(formatAuditDateTimeDisplay("2026-07-03 00:15:00")).toBe("03-07-2026 12:15 AM");
  });

  test("returns already formatted audit strings unchanged (normalized AM/PM)", () => {
    expect(formatAuditDateTimeDisplay("03-07-2026 5:30 PM")).toBe("03-07-2026 5:30 PM");
  });

  test("handles empty and invalid", () => {
    expect(formatAuditDateTimeDisplay("")).toBe("");
    expect(formatAuditDateTimeDisplay(null)).toBe("");
    expect(formatAuditDateTimeDisplay("not-a-date")).toBe("not-a-date");
  });
});
