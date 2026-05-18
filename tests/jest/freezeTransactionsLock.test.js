jest.mock("../../config/modules", () => ({
  modules: {
    financial_year_master: { table: "financial_year_master" }
  }
}));

jest.mock("../../lib/gridRowValue", () => ({
  rowValueForField: jest.fn((row, field) => (row && Object.prototype.hasOwnProperty.call(row, field) ? row[field] : null))
}));

jest.mock("../../lib/sqlModuleTable", () => ({
  escapeSqlTableIdForModuleConfig: jest.fn((cfg) => cfg?.table || "")
}));

jest.mock("../../lib/sqlDateFieldValue", () => ({
  toYyyyMmDdForSqlDateField: jest.fn((value) => String(value || "").slice(0, 10))
}));

const {
  shouldEnforceFreezeTransactionsForUser,
  assertDateNotInFrozenFinancialYear,
  FREEZE_TRANSACTIONS_LOCKED_MESSAGE
} = require("../../lib/modules/freezeTransactionsLock");

describe("freezeTransactionsLock", () => {
  test("shouldEnforceFreezeTransactionsForUser is true only for role 2", () => {
    expect(shouldEnforceFreezeTransactionsForUser({ role: 1 })).toBe(false);
    expect(shouldEnforceFreezeTransactionsForUser({ role: 2 })).toBe(true);
    expect(shouldEnforceFreezeTransactionsForUser({ role: 3 })).toBe(false);
    expect(shouldEnforceFreezeTransactionsForUser(null)).toBe(false);
  });

  test("assertDateNotInFrozenFinancialYear throws when FY is frozen", async () => {
    const conn = {
      query: jest.fn(async () => [[{ freezeTransactions: "Yes" }]])
    };
    const onBlocked = jest.fn(() => {
      throw new Error(FREEZE_TRANSACTIONS_LOCKED_MESSAGE);
    });
    await expect(
      assertDateNotInFrozenFinancialYear(conn, "2026-04-10", { onBlocked })
    ).rejects.toThrow(FREEZE_TRANSACTIONS_LOCKED_MESSAGE);
    expect(onBlocked).toHaveBeenCalled();
  });

  test("assertDateNotInFrozenFinancialYear is no-op when FY is not frozen", async () => {
    const conn = {
      query: jest.fn(async () => [[{ freezeTransactions: "No" }]])
    };
    const onBlocked = jest.fn();
    await assertDateNotInFrozenFinancialYear(conn, "2026-04-10", { onBlocked });
    expect(onBlocked).not.toHaveBeenCalled();
  });
});
