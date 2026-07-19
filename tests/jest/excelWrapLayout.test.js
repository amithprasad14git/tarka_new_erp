// Test file — Excel wrap layout (capped widths + row heights for older Excel).

import {
  estimateWrappedLineCount,
  estimateWrappedRowHeight,
  resolveExcelColumnWidth,
  excelColumnWrapsText,
  logoHeightPxToPoints
} from "../../lib/reports/excelWrapLayout";

describe("excelWrapLayout", () => {
  test("wrap column width stays at configured 24 even when sample text is 500 chars", () => {
    const longRemarks = "x".repeat(500);
    const width = resolveExcelColumnWidth(24, [longRemarks, "Remarks"], { wrapsText: true });
    expect(width).toBe(24);
  });

  test("wrap column width is capped near 40", () => {
    expect(resolveExcelColumnWidth(50, ["short"], { wrapsText: true })).toBe(40);
  });

  test("nowrap column may widen slightly for content but stays capped", () => {
    const width = resolveExcelColumnWidth(12, ["12345678901234567890"], { wrapsText: false });
    expect(width).toBeGreaterThanOrEqual(12);
    expect(width).toBeLessThanOrEqual(28);
  });

  test("nowrap width grows to longest INR sample over config", () => {
    const longAmount = "₹1,23,45,678.90";
    const width = resolveExcelColumnWidth(12, [longAmount, "Amt"], { wrapsText: false });
    expect(width).toBeGreaterThan(12);
    expect(width).toBeLessThanOrEqual(28);
  });

  test("row height increases for long remarks at width 24", () => {
    const longRemarks = "x".repeat(200);
    const base = estimateWrappedRowHeight("ok", 24, 9);
    const tall = estimateWrappedRowHeight(longRemarks, 24, 9);
    expect(tall).toBeGreaterThan(base);
    expect(estimateWrappedLineCount(longRemarks, 24)).toBeGreaterThan(1);
  });

  test("excelColumnWrapsText is false for inr, number, and date", () => {
    expect(excelColumnWrapsText({ type: "inr" })).toBe(false);
    expect(excelColumnWrapsText({ type: "number" })).toBe(false);
    expect(excelColumnWrapsText({ type: "date" })).toBe(false);
    expect(excelColumnWrapsText({ type: "text" })).toBe(true);
    expect(excelColumnWrapsText({})).toBe(true);
  });

  test("logoHeightPxToPoints converts 96 DPI px to Excel points with pad", () => {
    // 58px * 72/96 ≈ 43.5 → 44 + 10 pad
    expect(logoHeightPxToPoints(58, 10)).toBe(54);
  });
});
