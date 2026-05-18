import { formatInrNumberForDisplay, parseNumericCellValue } from "../../lib/formatInrNumber";
import { formatViewCellValue } from "../../lib/formatViewCellValue";

describe("formatInrNumberForDisplay", () => {
  it("groups amounts in en-IN without currency symbol", () => {
    expect(formatInrNumberForDisplay(1234567.5)).toBe("12,34,567.5");
    expect(formatInrNumberForDisplay("99999")).toBe("99,999");
  });

  it("parseNumericCellValue accepts INR-style grouped input for filters", () => {
    expect(parseNumericCellValue("1,50,000")).toBe(150000);
    expect(parseNumericCellValue("12,34,567.5")).toBe(1234567.5);
    expect(parseNumericCellValue("not-a-number")).toBeNull();
  });

  it("formats integerOnly fields without decimals", () => {
    expect(formatInrNumberForDisplay(1234.9, { integerOnly: true })).toBe("1,234");
  });
});

describe("formatViewCellValue", () => {
  it("formats number fields for view grids", () => {
    expect(formatViewCellValue({ type: "number" }, 150000)).toBe("1,50,000");
    expect(formatViewCellValue({ type: "number", integerOnly: true }, 42.7)).toBe("42");
  });

  it("still formats dates as DD-MM-YYYY", () => {
    expect(formatViewCellValue({ type: "date" }, "2024-03-15")).toBe("15-03-2024");
  });
});
