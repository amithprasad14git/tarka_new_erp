/**
 * Tests for lib/viewGridColumnEmphasis.js
 */

const {
  VIEW_GRID_EMPHASIS_CELL_CLASS,
  getViewGridColumnClass,
  isViewGridEmphasisField
} = require("../../lib/viewGridColumnEmphasis");

describe("viewGridColumnEmphasis", () => {
  const emphasizedByModule = {
    new_case_inward: ["caseNo"],
    sarfaesi_case_status_update: ["caseNo"],
    recovery_invoice: ["invoiceNo", "caseNo"],
    sarfaesi_invoice: ["invoiceNo", "caseNo"],
    vehicle_invoice: ["invoiceNo", "caseNo"],
    invoices_received: ["refNo"],
    transfer_case: ["caseNo"],
    public_notice: ["caseNo"],
    return_case: ["caseNo"]
  };

  test.each(Object.entries(emphasizedByModule))(
    "%s emphasizes configured fields",
    (moduleKey, fields) => {
      for (const fieldName of fields) {
        expect(isViewGridEmphasisField(moduleKey, fieldName)).toBe(true);
        expect(getViewGridColumnClass(moduleKey, fieldName)).toBe(VIEW_GRID_EMPHASIS_CELL_CLASS);
      }
    }
  );

  test("does not emphasize unrelated fields on configured modules", () => {
    expect(getViewGridColumnClass("new_case_inward", "borrower")).toBe("");
    expect(getViewGridColumnClass("recovery_invoice", "date")).toBe("");
    expect(getViewGridColumnClass("invoices_received", "caseNo")).toBe("");
    expect(getViewGridColumnClass("transfer_case", "refNo")).toBe("");
    expect(getViewGridColumnClass("public_notice", "refNo")).toBe("");
    expect(getViewGridColumnClass("return_case", "refNo")).toBe("");
  });

  test("returns empty for unknown modules", () => {
    expect(isViewGridEmphasisField("unit_master", "caseNo")).toBe(false);
    expect(getViewGridColumnClass("unknown_module", "caseNo")).toBe("");
  });
});
