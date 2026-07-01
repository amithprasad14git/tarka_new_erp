/**
 * Tests for lib/modules/invoiceFinalInvoice.js (Final Invoice / NCI sync).
 */

// Replace real database, auth, and Next.js pieces with fakes so tests run offline.
jest.mock("../../config/modules", () => ({
  modules: {
    new_case_inward: { table: "new_case_inward" },
    recovery_invoice: { table: "recovery_invoice" },
    sarfaesi_invoice: { table: "sarfaesi_invoice" },
    vehicle_invoice: { table: "vehicle_invoice" }
  }
}));

const {
  anyInvoiceFinalYesForCase,
  recomputeNciFinalInvoiceForCase,
  normalizeFinalInvoiceFlag,
  isInvoiceFinalInvoiceUnlockUpdate,
  appendInvoiceCasePickerExcludeFinalYesFilter
} = require("../../lib/modules/invoiceFinalInvoice");

// Automated checks for: invoiceFinalInvoice.
describe("invoiceFinalInvoice", () => {
// Checks incoming form data is cleaned and rejected when rules are broken.
  describe("normalizeFinalInvoiceFlag", () => {
    it("normalizes to Yes or No", () => {
      expect(normalizeFinalInvoiceFlag("yes")).toBe("Yes");
      expect(normalizeFinalInvoiceFlag("NO")).toBe("No");
      expect(normalizeFinalInvoiceFlag("")).toBe("No");
    });
  });

// Automated checks for: anyInvoiceFinalYesForCase.
  describe("anyInvoiceFinalYesForCase", () => {
    it("returns true when union query returns rows", async () => {
      const conn = {
        query: jest.fn().mockResolvedValue([[{ hit: 1 }]])
      };
      await expect(anyInvoiceFinalYesForCase(conn, 42)).resolves.toBe(true);
      expect(conn.query).toHaveBeenCalledTimes(1);
      const [sql, params] = conn.query.mock.calls[0];
      expect(sql).toContain("recovery_invoice");
      expect(sql).toContain("sarfaesi_invoice");
      expect(sql).toContain("vehicle_invoice");
      expect(sql).toMatch(/LIMIT\s+1\s*$/i);
      expect(params).toEqual([42, 42, 42]);
    });

    it("returns false for invalid case id", async () => {
      const conn = { query: jest.fn() };
      await expect(anyInvoiceFinalYesForCase(conn, 0)).resolves.toBe(false);
      expect(conn.query).not.toHaveBeenCalled();
    });
  });

// Automated checks for: recomputeNciFinalInvoiceForCase.
  describe("recomputeNciFinalInvoiceForCase", () => {
    it("sets NCI to Yes when any invoice is final", async () => {
      const conn = {
        query: jest
          .fn()
          .mockResolvedValueOnce([[{ hit: 1 }]])
          .mockResolvedValueOnce([{ affectedRows: 1 }])
      };
      await recomputeNciFinalInvoiceForCase(conn, 10);
      expect(conn.query).toHaveBeenCalledTimes(2);
      const updateCall = conn.query.mock.calls[1];
      expect(updateCall[0]).toContain("UPDATE");
      expect(updateCall[0]).toContain("new_case_inward");
      expect(updateCall[1]).toEqual(["Yes", 10]);
    });

    it("sets NCI to No when no invoice is final", async () => {
      const conn = {
        query: jest
          .fn()
          .mockResolvedValueOnce([[]])
          .mockResolvedValueOnce([{ affectedRows: 1 }])
      };
      await recomputeNciFinalInvoiceForCase(conn, 10);
      expect(conn.query.mock.calls[1][1]).toEqual(["No", 10]);
    });
  });

  describe("isInvoiceFinalInvoiceUnlockUpdate", () => {
    const oldRow = {
      date: "2026-04-10",
      caseNo: 1,
      billToUnit: 2,
      npaCurrentAc: 3,
      cancelledInvoice: "No",
      finalInvoice: "Yes",
      grandTotal: 1000
    };

    it("returns true for Final Yes to No with unchanged fields and matching charges", () => {
      expect(
        isInvoiceFinalInvoiceUnlockUpdate(oldRow, { finalInvoice: "No" }, { childTotal: 1000 })
      ).toBe(true);
    });

    it("returns false when final stays Yes", () => {
      expect(
        isInvoiceFinalInvoiceUnlockUpdate(oldRow, { finalInvoice: "Yes" }, { childTotal: 1000 })
      ).toBe(false);
    });

    it("returns false when date changes", () => {
      expect(
        isInvoiceFinalInvoiceUnlockUpdate(
          oldRow,
          { finalInvoice: "No", date: "2026-05-01" },
          { childTotal: 1000 }
        )
      ).toBe(false);
    });

    it("returns false when caseNo changes", () => {
      expect(
        isInvoiceFinalInvoiceUnlockUpdate(
          oldRow,
          { finalInvoice: "No", caseNo: 99 },
          { childTotal: 1000 }
        )
      ).toBe(false);
    });

    it("returns false when charge total differs from stored grandTotal", () => {
      expect(
        isInvoiceFinalInvoiceUnlockUpdate(oldRow, { finalInvoice: "No" }, { childTotal: 500 })
      ).toBe(false);
    });
  });

// Checks list search and column filters build safe SQL and match the right rows.
  describe("appendInvoiceCasePickerExcludeFinalYesFilter", () => {
    it("appends finalInvoice filter on NCI", () => {
      const whereParts = [];
      const whereValues = [];
      const mysql = { escapeId: (n) => `\`${n}\`` };
      appendInvoiceCasePickerExcludeFinalYesFilter({
        mysql,
        mainTableRef: "nci",
        whereParts,
        whereValues
      });
      expect(whereParts).toHaveLength(1);
      expect(whereParts[0]).toContain("finalInvoice");
      expect(whereParts[0]).toContain("<> 'yes'");
    });
  });
});
