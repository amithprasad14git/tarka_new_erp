/** @jest-environment node */

jest.mock("../../config/modules", () => ({
  modules: {
    recovery_invoice: { table: "recovery_invoice" },
    current_account_master: { table: "current_account_master" },
    financial_year_master: { table: "financial_year_master" }
  }
}));

jest.mock("../../lib/modules/invoiceFinalInvoice", () => ({
  assertCaseEligibleForNewInvoice: jest.fn(),
  isInvoiceFinalInvoiceUnlockUpdate: jest.fn(() => false),
  normalizeFinalInvoiceFlag: jest.fn((v) => v),
  syncNciFinalInvoiceAfterInvoiceWrite: jest.fn()
}));

jest.mock("../../lib/modules/freezeTransactionsLock", () => ({
  shouldEnforceFreezeTransactionsForUser: jest.fn(() => false),
  assertDateNotInFrozenFinancialYear: jest.fn()
}));

jest.mock("../../lib/sqlModuleTable", () => ({
  escapeSqlTableId: jest.fn((n) => n),
  escapeSqlTableIdForModuleConfig: jest.fn((m) => m?.table || "")
}));

const { applyRecoveryInvoiceBeforeWrite } = require("../../lib/modules/recoveryInvoice");

function createConn(activeNpa = true) {
  return {
    query: jest.fn(async (sql) => {
      if (sql.includes("current_account_master") && sql.includes("active")) {
        return activeNpa ? [[{ id: 1 }]] : [[]];
      }
      return [[]];
    })
  };
}

describe("recoveryInvoice validate without caseNo", () => {
  test("create without caseNo requires billToUnit and npaCurrentAc", async () => {
    const conn = createConn();
    await expect(
      applyRecoveryInvoiceBeforeWrite(conn, {
        oldRow: null,
        merged: {
          date: "2026-06-01",
          billToUnit: null,
          npaCurrentAc: null,
          finalInvoice: "Yes"
        },
        childTableRows: {},
        user: { id: 1, role: 1 }
      })
    ).rejects.toMatchObject({
      code: "RECOVERY_INVOICE_VALIDATION_FAILED",
      message: "Bill to Unit is required when Case No is not selected."
    });
  });

  test("create without caseNo rejects inactive npaCurrentAc", async () => {
    const conn = createConn(false);
    await expect(
      applyRecoveryInvoiceBeforeWrite(conn, {
        oldRow: null,
        merged: {
          date: "2026-06-01",
          billToUnit: 2,
          npaCurrentAc: 1,
          finalInvoice: "Yes"
        },
        childTableRows: {},
        user: { id: 1, role: 1 }
      })
    ).rejects.toMatchObject({
      code: "RECOVERY_INVOICE_VALIDATION_FAILED",
      message: "NPA Current AC must be an active Current Account record."
    });
  });

  test("create without caseNo passes with billToUnit and active npa", async () => {
    const conn = createConn(true);
    const merged = {
      date: "2026-06-01",
      billToUnit: 2,
      npaCurrentAc: 1,
      finalInvoice: "Yes"
    };
    await expect(
      applyRecoveryInvoiceBeforeWrite(conn, {
        oldRow: null,
        merged,
        childTableRows: {},
        user: { id: 1, role: 1 }
      })
    ).resolves.toBeUndefined();
    expect(merged.grandTotal).toBe(0);
  });
});
