// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `formatReportDateDisplay`.
 * Run with: npm test
 */

import { formatReportDateDisplay } from "../../lib/formatReportDateDisplay";
import { formatReportCellValue } from "../../lib/formatReportCellValue";
import { toYyyyMmDdForSqlDateField } from "../../lib/sqlDateFieldValue";

describe("formatReportDateDisplay", () => {
  test("formats YYYY-MM-DD as DD-MM-YYYY", () => {
    expect(formatReportDateDisplay("2026-03-15")).toBe("15-03-2026");
  });

  test("formats pre-formatted DD-MM-YYYY from SQL", () => {
    expect(formatReportDateDisplay("15-03-2026")).toBe("15-03-2026");
  });

  test("formats pre-formatted DD/MM/YYYY", () => {
    expect(formatReportDateDisplay("15/03/2026")).toBe("15-03-2026");
  });

  test("returns empty string for null", () => {
    expect(formatReportDateDisplay(null)).toBe("");
  });
});

describe("toYyyyMmDdForSqlDateField display date parsing", () => {
  test("parses DD-MM-YYYY", () => {
    expect(toYyyyMmDdForSqlDateField("15-03-2026")).toBe("2026-03-15");
  });

  test("parses DD/MM/YYYY", () => {
    expect(toYyyyMmDdForSqlDateField("15/03/2026")).toBe("2026-03-15");
  });
});

describe("formatReportCellValue date columns", () => {
  test("uses DD-MM-YYYY for type date", () => {
    expect(formatReportCellValue({ type: "date" }, "2026-03-15")).toBe("15-03-2026");
  });
});

