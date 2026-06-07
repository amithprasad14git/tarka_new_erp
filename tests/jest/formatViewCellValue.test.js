// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `formatViewCellValue`.
 * Run with: npm test
 */

import {
  formatInrNumberForDisplay,
  formatReportAmountForDisplay,
  parseNumericCellValue
} from "../../lib/formatInrNumber";
import { formatReportCellValue } from "../../lib/formatReportCellValue";
import { formatViewCellValue } from "../../lib/formatViewCellValue";

// Checks money amounts convert to the correct words for invoices and letters.
describe("formatInrNumberForDisplay", () => {
  it("groups amounts in en-IN without currency symbol", () => {
    expect(formatInrNumberForDisplay(1234567.5)).toBe("12,34,567.5");
    expect(formatInrNumberForDisplay("99999")).toBe("99,999");
    expect(formatInrNumberForDisplay(1000, { fixedDecimals: 2 })).toBe("1,000.00");
    expect(formatInrNumberForDisplay(1234.5, { fixedDecimals: 2 })).toBe("1,234.50");
  });

  it("parseNumericCellValue accepts INR-style grouped input for filters", () => {
    expect(parseNumericCellValue("1,50,000")).toBe(150000);
    expect(parseNumericCellValue("12,34,567.5")).toBe(1234567.5);
    expect(parseNumericCellValue("not-a-number")).toBeNull();
  });

  it("formats integerOnly fields without decimals", () => {
    expect(formatInrNumberForDisplay(1234.9, { integerOnly: true })).toBe("1,234");
  });

  it("formatReportAmountForDisplay always shows 2 decimals", () => {
    expect(formatReportAmountForDisplay(1000)).toBe("1,000.00");
    expect(formatReportAmountForDisplay(1234.5)).toBe("1,234.50");
    expect(formatReportAmountForDisplay("")).toBe("");
  });
});

describe("formatReportCellValue", () => {
  it("formats inr columns with 2 decimals for HTML reports", () => {
    expect(formatReportCellValue({ type: "inr" }, 5000)).toBe("5,000.00");
    expect(formatReportCellValue({ type: "inr" }, 1234.5)).toBe("1,234.50");
  });

  it("formats number columns as integers", () => {
    expect(formatReportCellValue({ type: "number" }, 42.9)).toBe("42");
  });
});

// Automated checks for: formatViewCellValue.
describe("formatViewCellValue", () => {
  it("formats number fields for view grids", () => {
    expect(formatViewCellValue({ type: "number" }, 150000)).toBe("1,50,000");
    expect(formatViewCellValue({ type: "number", integerOnly: true }, 42.7)).toBe("42");
  });

  it("still formats dates as DD-MM-YYYY", () => {
    expect(formatViewCellValue({ type: "date" }, "2024-03-15")).toBe("15-03-2024");
  });
});

