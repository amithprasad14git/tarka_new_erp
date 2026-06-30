/** @jest-environment node */

jest.mock("../../config/modules", () => ({
  modules: {
    recovery_invoice: {
      fields: [
        { name: "date", type: "date" },
        { name: "grandTotal", type: "number" }
      ]
    }
  }
}));

jest.mock("../../lib/sqlDateFieldValue", () => ({
  toYyyyMmDdForSqlDateField: jest.fn((value) => String(value || "").slice(0, 10))
}));

const { formatViewCellValue } = require("../../lib/formatViewCellValue");
const { modules } = require("../../config/modules");

function formatPickerCellValue(lookup, fieldName, rawValue) {
  if (rawValue == null || rawValue === "") return "";
  const modKey = String(lookup?.module ?? "").trim();
  const refCfg = modKey ? modules[modKey] : null;
  const fieldDef = refCfg?.fields?.find((f) => f.name === fieldName);
  if (fieldDef) {
    const formatted = formatViewCellValue(fieldDef, rawValue);
    if (formatted !== "") return String(formatted);
  }
  return String(rawValue);
}

describe("lookup picker cell formatting", () => {
  const lookup = { module: "recovery_invoice" };

  test("formats date as DD-MM-YYYY", () => {
    expect(formatPickerCellValue(lookup, "date", "2026-05-16")).toBe("16-05-2026");
  });

  test("formats grandTotal with grouping", () => {
    expect(formatPickerCellValue(lookup, "grandTotal", 15000)).toBe("15,000");
  });
});
