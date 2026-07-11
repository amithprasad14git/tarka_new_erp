// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `formatReportGeneratedAt`.
 * Run with: npm test
 */

import { formatReportGeneratedAtDisplay } from "../../lib/formatReportGeneratedAt";

describe("formatReportGeneratedAtDisplay", () => {
  test("formats MySQL IST datetime as DD-MM-YYYY, HH:mm (no seconds)", () => {
    expect(formatReportGeneratedAtDisplay("2026-06-02 14:30:45")).toBe("02-06-2026, 14:30");
  });

  test("returns raw string when pattern does not match", () => {
    expect(formatReportGeneratedAtDisplay("invalid")).toBe("invalid");
    expect(formatReportGeneratedAtDisplay("")).toBe("");
  });
});

