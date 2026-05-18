/**
 * Tests for lib/auditDisplay.js
 */

jest.mock("../../config/modules", () => ({
  modules: {
    recovery_invoice: {
      label: "Recovery Invoice",
      lookupDisplayField: "invoiceNo",
      fields: [
        { name: "invoiceNo", label: "Invoice No" },
        { name: "finalInvoice", label: "Final Invoice" },
        { name: "caseNo", type: "lookup", label: "Case No" }
      ]
    },
    new_case_inward: {
      label: "New Case Inward",
      lookupDisplayField: "caseNo",
      fields: [{ name: "caseNo", label: "Case No" }]
    },
    branch_master: {
      lookupDisplayField: "branchCode - branchName",
      fields: [{ name: "branchCode" }, { name: "branchName" }]
    },
    no_label_module: {
      fields: [{ name: "internalCode" }]
    }
  }
}));

const {
  buildAuditRecordLabel,
  formatAuditModuleLabel,
  resolveAuditFieldLabel
} = require("../../lib/auditDisplay");

describe("auditDisplay", () => {
  describe("buildAuditRecordLabel", () => {
    it("uses lookupDisplayField for single column", () => {
      expect(
        buildAuditRecordLabel("recovery_invoice", { invoiceNo: "INV/2627/0007" }, 4)
      ).toBe("INV/2627/0007");
    });

    it("joins multi-column lookupDisplayField", () => {
      expect(
        buildAuditRecordLabel(
          "branch_master",
          { branchCode: "BR01", branchName: "Main" },
          1
        )
      ).toBe("BR01 - Main");
    });

    it("falls back to Record #id when row has no display parts", () => {
      expect(buildAuditRecordLabel("no_label_module", { internalCode: "x" }, 99)).toBe("Record #99");
    });

    it("returns empty for unknown module without id", () => {
      expect(buildAuditRecordLabel("unknown_module", null)).toBe("");
    });
  });

  describe("formatAuditModuleLabel", () => {
    it("returns module label from config", () => {
      expect(formatAuditModuleLabel("recovery_invoice")).toBe("Recovery Invoice");
    });

    it("returns key when module unknown", () => {
      expect(formatAuditModuleLabel("unknown_xyz")).toBe("unknown_xyz");
    });
  });

  describe("resolveAuditFieldLabel", () => {
    it("returns field label from config", () => {
      expect(resolveAuditFieldLabel("recovery_invoice", "finalInvoice")).toBe("Final Invoice");
    });
  });
});
