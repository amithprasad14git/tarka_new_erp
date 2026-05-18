// FY freezeTransactions on accounts + invoice modules (role 2 enforced, admin skipped).

jest.mock("../../config/modules", () => ({
  modules: {
    financial_year_master: { table: "financial_year_master" },
    accounts_assets_investments: { table: "accounts_assets_investments" },
    accounts_cash_deposit_withdraw: { table: "accounts_cash_deposit_withdraw" },
    accounts_current_ac_transfer: { table: "accounts_current_ac_transfer" },
    accounts_expense_voucher: { table: "accounts_expense_voucher" },
    accounts_loan_ac: { table: "accounts_loan_ac" },
    accounts_suspense_entry: { table: "accounts_suspense_entry" },
    new_case_inward: { table: "new_case_inward" },
    recovery_invoice: { table: "recovery_invoice" },
    sarfaesi_invoice: { table: "sarfaesi_invoice" },
    vehicle_invoice: { table: "vehicle_invoice" },
    lookup_value_master: { table: "lookup_value_master" }
  }
}));

jest.mock("../../lib/gridRowValue", () => ({
  rowValueForField: jest.fn((row, field) =>
    row && Object.prototype.hasOwnProperty.call(row, field) ? row[field] : null
  )
}));

jest.mock("../../lib/sqlModuleTable", () => ({
  escapeSqlTableId: jest.fn((name) => name),
  escapeSqlTableIdForModuleConfig: jest.fn((cfg) => cfg?.table || "")
}));

jest.mock("../../lib/sqlDateFieldValue", () => ({
  toYyyyMmDdForSqlDateField: jest.fn((value) => String(value || "").slice(0, 10))
}));

const { FREEZE_TRANSACTIONS_LOCKED_MESSAGE } = require("../../lib/modules/freezeTransactionsLock");
const { validateAccountsAssetsInvestmentsBeforeWrite } = require("../../lib/modules/accountsAssetsInvestments");
const { validateAccountsCashDepositWithdrawBeforeWrite } = require("../../lib/modules/accountsCashDepositWithdraw");
const { validateAccountsCurrentAcTransferBeforeWrite } = require("../../lib/modules/accountsCurrentAcTransfer");
const { validateAccountsExpenseVoucherBeforeWrite } = require("../../lib/modules/accountsExpenseVoucher");
const { validateAccountsLoanAcBeforeWrite } = require("../../lib/modules/accountsLoanAc");
const { validateAccountsSuspenseEntryBeforeWrite } = require("../../lib/modules/accountsSuspenseEntry");
const { applyRecoveryInvoiceBeforeWrite } = require("../../lib/modules/recoveryInvoice");
const { applySarfaesiInvoiceBeforeWrite } = require("../../lib/modules/sarfaesiInvoice");
const { applyVehicleInvoiceBeforeWrite } = require("../../lib/modules/vehicleInvoice");

const TEST_DATE = "2026-04-10";

const fyFreezeLockedRoute = {
  when: (sql) => sql.includes("freezeTransactions") && sql.includes("financial_year_master"),
  reply: [[{ freezeTransactions: "Yes" }]]
};

function createConn(extraRoutes = []) {
  return {
    query: jest.fn(async (sql, params = []) => {
      if (fyFreezeLockedRoute.when(sql, params)) {
        return typeof fyFreezeLockedRoute.reply === "function"
          ? fyFreezeLockedRoute.reply(sql, params)
          : fyFreezeLockedRoute.reply;
      }
      for (const r of extraRoutes) {
        if (r.when(sql, params)) {
          return typeof r.reply === "function" ? r.reply(sql, params) : r.reply;
        }
      }
      throw new Error(`Unexpected query:\n${sql}\nparams:${JSON.stringify(params)}`);
    })
  };
}

describe("FY freeze on accounts and invoice modules", () => {
  const role2FrozenCases = [
    {
      name: "accounts_assets_investments",
      run: (conn) =>
        validateAccountsAssetsInvestmentsBeforeWrite(conn, {
          parentData: { date: TEST_DATE },
          user: { role: 2 }
        }),
      code: "ACCOUNTS_ASSETS_INVESTMENTS_VALIDATION_FAILED"
    },
    {
      name: "accounts_cash_deposit_withdraw",
      run: (conn) =>
        validateAccountsCashDepositWithdrawBeforeWrite(conn, {
          parentData: { date: TEST_DATE },
          user: { role: 2 }
        }),
      code: "ACCOUNTS_CASH_DEPOSIT_WITHDRAW_VALIDATION_FAILED"
    },
    {
      name: "accounts_current_ac_transfer",
      run: (conn) =>
        validateAccountsCurrentAcTransferBeforeWrite(conn, {
          parentData: { date: TEST_DATE, fromCurrentAc: 1, toCurrentAc: 2 },
          user: { role: 2 }
        }),
      code: "ACCOUNTS_CURRENT_AC_TRANSFER_VALIDATION_FAILED"
    },
    {
      name: "accounts_expense_voucher",
      run: (conn) =>
        validateAccountsExpenseVoucherBeforeWrite(conn, {
          parentData: { date: TEST_DATE },
          user: { role: 2 }
        }),
      code: "ACCOUNTS_EXPENSE_VOUCHER_VALIDATION_FAILED"
    },
    {
      name: "accounts_loan_ac",
      run: (conn) =>
        validateAccountsLoanAcBeforeWrite(conn, {
          parentData: { date: TEST_DATE },
          user: { role: 2 }
        }),
      code: "ACCOUNTS_LOAN_AC_VALIDATION_FAILED"
    },
    {
      name: "accounts_suspense_entry",
      run: (conn) =>
        validateAccountsSuspenseEntryBeforeWrite(conn, {
          parentData: { date: TEST_DATE },
          user: { role: 2 }
        }),
      code: "ACCOUNTS_SUSPENSE_ENTRY_VALIDATION_FAILED"
    },
    {
      name: "recovery_invoice",
      run: (conn) =>
        applyRecoveryInvoiceBeforeWrite(conn, {
          oldRow: null,
          merged: { date: TEST_DATE, caseNo: 1 },
          childTableRows: {},
          user: { role: 2 }
        }),
      code: "RECOVERY_INVOICE_VALIDATION_FAILED"
    },
    {
      name: "sarfaesi_invoice",
      run: (conn) =>
        applySarfaesiInvoiceBeforeWrite(conn, {
          oldRow: null,
          merged: { date: TEST_DATE, caseNo: 1 },
          childTableRows: {},
          user: { role: 2 }
        }),
      code: "SARFAESI_INVOICE_VALIDATION_FAILED"
    },
    {
      name: "vehicle_invoice",
      run: (conn) =>
        applyVehicleInvoiceBeforeWrite(conn, {
          oldRow: null,
          merged: { date: TEST_DATE, caseNo: 1 },
          childTableRows: {},
          user: { role: 2 }
        }),
      code: "VEHICLE_INVOICE_VALIDATION_FAILED"
    }
  ];

  test.each(role2FrozenCases)("blocks role 2 for $name when FY is frozen", async ({ run, code }) => {
    const conn = createConn();
    await expect(run(conn)).rejects.toMatchObject({
      code,
      message: FREEZE_TRANSACTIONS_LOCKED_MESSAGE
    });
  });

  test("allows admin for accounts_suspense_entry when FY is frozen", async () => {
    const conn = createConn();
    await expect(
      validateAccountsSuspenseEntryBeforeWrite(conn, {
        parentData: { date: TEST_DATE },
        user: { role: 1 }
      })
    ).resolves.toBeUndefined();
    expect(conn.query).not.toHaveBeenCalled();
  });

  test("allows admin for accounts_current_ac_transfer when FY is frozen", async () => {
    const conn = createConn();
    await expect(
      validateAccountsCurrentAcTransferBeforeWrite(conn, {
        parentData: { date: TEST_DATE, fromCurrentAc: 1, toCurrentAc: 2 },
        user: { role: 1 }
      })
    ).resolves.toBeUndefined();
    expect(conn.query).not.toHaveBeenCalled();
  });
});
