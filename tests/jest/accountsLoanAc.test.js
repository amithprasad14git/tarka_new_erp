// Test file for validating app behavior and regression safety.
// Keep module-specific business logic in lib/modules/<module> files.

jest.mock("../../config/modules", () => ({
  modules: {
    accounts_loan_ac: { table: "accounts_loan_ac" },
    financial_year_master: { table: "financial_year_master" },
    current_account_master: { table: "current_account_master" }
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

const sqlDateFieldValue = require("../../lib/sqlDateFieldValue");

const {
  assignAccountsLoanAcVoucherNo,
  ACCOUNTS_LOAN_AC_MODULE_KEY,
  assertAccountsLoanAcTransactionType,
  assertAccountsLoanAcNpaCurrentAcRule,
  assertAccountsLoanAcPaymentMode,
  assertAccountsLoanAcChequeFields,
  assertAccountsLoanAcRole2UnitAndCurrentAc,
  validateAccountsLoanAcBeforeWrite,
  applyAccountsLoanAcBeforeWrite
} = require("../../lib/modules/accountsLoanAc");

function createConn() {
  return {
    query: jest.fn()
  };
}

describe("accountsLoanAc module", () => {
  test("assignAccountsLoanAcVoucherNo stamps Receipt as LN/CR/<year>/<serial>", async () => {
    const conn = createConn();

    conn.query.mockImplementation(async (sql) => {
      if (sql.includes("FROM accounts_loan_ac WHERE id")) {
        return [[{ id: 1, date: "2026-01-15", transactionType: "Receipt" }]];
      }
      if (sql.includes("financial_year_master")) {
        return [[{ yearCode: "2526" }]];
      }
      if (sql.includes("INSERT INTO module_number_sequence")) {
        return [{}];
      }
      if (sql.includes("SELECT lastNumber FROM module_number_sequence") && sql.includes("FOR UPDATE")) {
        return [[{ lastNumber: 7 }]];
      }
      if (sql.includes("UPDATE module_number_sequence SET lastNumber")) {
        return [{}];
      }
      if (sql.includes("SET voucherNo") && sql.includes("accounts_loan_ac")) {
        return [{}];
      }
      throw new Error(`Unexpected query:\n${sql}`);
    });

    await assignAccountsLoanAcVoucherNo(conn, 1);

    const updateCalls = conn.query.mock.calls.filter((c) =>
      String(c[0]).includes("UPDATE accounts_loan_ac")
    );
    expect(updateCalls.length).toBe(1);
    const params = updateCalls[0][1];
    expect(params[0]).toBe("LN/CR/2526/0008");
    expect(params[1]).toBe(1);
    expect(ACCOUNTS_LOAN_AC_MODULE_KEY).toBe("accounts_loan_ac");
  });

  test("assignAccountsLoanAcVoucherNo stamps Payment as LN/DR/<year>/<serial>", async () => {
    const conn = createConn();

    conn.query.mockImplementation(async (sql) => {
      if (sql.includes("FROM accounts_loan_ac WHERE id")) {
        return [[{ id: 2, date: "2026-01-15", transactionType: "Payment" }]];
      }
      if (sql.includes("financial_year_master")) {
        return [[{ yearCode: "2526" }]];
      }
      if (sql.includes("INSERT INTO module_number_sequence")) {
        return [{}];
      }
      if (sql.includes("SELECT lastNumber FROM module_number_sequence") && sql.includes("FOR UPDATE")) {
        return [[{ lastNumber: 0 }]];
      }
      if (sql.includes("UPDATE module_number_sequence SET lastNumber")) {
        return [{}];
      }
      if (sql.includes("UPDATE accounts_loan_ac SET voucherNo")) {
        return [{}];
      }
      throw new Error(`Unexpected query:\n${sql}`);
    });

    await assignAccountsLoanAcVoucherNo(conn, 2);

    const updateCalls = conn.query.mock.calls.filter((c) =>
      String(c[0]).includes("UPDATE accounts_loan_ac SET voucherNo")
    );
    expect(updateCalls[0][1][0]).toBe("LN/DR/2526/0001");
  });

  test("assignAccountsLoanAcVoucherNo rejects missing transaction type", async () => {
    const conn = createConn();
    conn.query.mockImplementation(async (sql) => {
      if (sql.includes("FROM accounts_loan_ac WHERE id")) {
        return [[{ id: 1, date: "2026-01-15", transactionType: "" }]];
      }
      throw new Error(`Unexpected query:\n${sql}`);
    });

    await expect(assignAccountsLoanAcVoucherNo(conn, 1)).rejects.toMatchObject({
      code: "ACCOUNTS_LOAN_AC_VALIDATION_FAILED"
    });
  });

  test("assertAccountsLoanAcTransactionType rejects invalid type", () => {
    expect(() => assertAccountsLoanAcTransactionType({ transactionType: "X" })).toThrow();
  });

  test("assertAccountsLoanAcNpaCurrentAcRule rejects cash when NPA is set", () => {
    expect(() =>
      assertAccountsLoanAcNpaCurrentAcRule({ paymentMode: "Cash", npaCurrentAc: 5 })
    ).toThrow();
  });

  test("assertAccountsLoanAcNpaCurrentAcRule allows cash with empty NPA", () => {
    expect(() => assertAccountsLoanAcNpaCurrentAcRule({ paymentMode: "Cash", npaCurrentAc: null })).not.toThrow();
  });

  test("assertAccountsLoanAcNpaCurrentAcRule requires NPA when not cash", () => {
    expect(() =>
      assertAccountsLoanAcNpaCurrentAcRule({ paymentMode: "Card", npaCurrentAc: null })
    ).toThrow();
  });

  test("assertAccountsLoanAcPaymentMode rejects empty and invalid modes", () => {
    expect(() => assertAccountsLoanAcPaymentMode({})).toThrow();
    expect(() => assertAccountsLoanAcPaymentMode({ paymentMode: "wire" })).toThrow();
  });

  test("assertAccountsLoanAcChequeFields requires cheque no and date", () => {
    expect(() =>
      assertAccountsLoanAcChequeFields({
        paymentMode: "Cheque",
        chequeNo: "",
        chequeDate: "2026-01-01"
      })
    ).toThrow();
    sqlDateFieldValue.toYyyyMmDdForSqlDateField.mockImplementationOnce(() => "");
    expect(() =>
      assertAccountsLoanAcChequeFields({
        paymentMode: "Cheque",
        chequeNo: "CHQ1",
        chequeDate: ""
      })
    ).toThrow();
    sqlDateFieldValue.toYyyyMmDdForSqlDateField.mockImplementation((value) =>
      String(value || "").slice(0, 10)
    );
  });

  test("assignAccountsLoanAcVoucherNo rejects when row not found", async () => {
    const conn = createConn();
    conn.query.mockResolvedValueOnce([[]]);
    await expect(assignAccountsLoanAcVoucherNo(conn, 1)).rejects.toMatchObject({
      code: "ACCOUNTS_LOAN_AC_VALIDATION_FAILED"
    });
  });

  test("assignAccountsLoanAcVoucherNo rejects when FY missing", async () => {
    const conn = createConn();
    conn.query.mockImplementation(async (sql) => {
      if (sql.includes("FROM accounts_loan_ac WHERE id")) {
        return [[{ id: 1, date: "2026-01-15", transactionType: "Receipt" }]];
      }
      if (sql.includes("financial_year_master")) {
        return [[{ yearCode: "" }]];
      }
      throw new Error(sql);
    });
    await expect(assignAccountsLoanAcVoucherNo(conn, 1)).rejects.toMatchObject({
      code: "ACCOUNTS_LOAN_AC_VALIDATION_FAILED"
    });
  });

  test("assignAccountsLoanAcVoucherNo rejects when date missing for FY resolution", async () => {
    sqlDateFieldValue.toYyyyMmDdForSqlDateField.mockReturnValueOnce("");
    const conn = createConn();
    conn.query.mockImplementation(async (sql) => {
      if (sql.includes("FROM accounts_loan_ac WHERE id")) {
        return [[{ id: 1, date: "", transactionType: "Receipt" }]];
      }
      throw new Error(sql);
    });
    await expect(assignAccountsLoanAcVoucherNo(conn, 1)).rejects.toMatchObject({
      code: "ACCOUNTS_LOAN_AC_VALIDATION_FAILED"
    });
    sqlDateFieldValue.toYyyyMmDdForSqlDateField.mockImplementation((value) =>
      String(value || "").slice(0, 10)
    );
  });

  test("assignAccountsLoanAcVoucherNo rejects when sequence row missing", async () => {
    const conn = createConn();
    conn.query.mockImplementation(async (sql) => {
      if (sql.includes("FROM accounts_loan_ac WHERE id")) {
        return [[{ id: 1, date: "2026-01-15", transactionType: "Receipt" }]];
      }
      if (sql.includes("financial_year_master")) {
        return [[{ yearCode: "2526" }]];
      }
      if (sql.includes("INSERT INTO module_number_sequence")) {
        return [{}];
      }
      if (sql.includes("SELECT lastNumber FROM module_number_sequence") && sql.includes("FOR UPDATE")) {
        return [[]];
      }
      throw new Error(sql);
    });
    await expect(assignAccountsLoanAcVoucherNo(conn, 1)).rejects.toMatchObject({
      code: "ACCOUNTS_LOAN_AC_VALIDATION_FAILED"
    });
  });

  test("assignAccountsLoanAcVoucherNo uses next=1 when lastNumber is non-finite", async () => {
    const conn = createConn();
    conn.query.mockImplementation(async (sql) => {
      if (sql.includes("FROM accounts_loan_ac WHERE id")) {
        return [[{ id: 1, date: "2026-01-15", transactionType: "Receipt" }]];
      }
      if (sql.includes("financial_year_master")) {
        return [[{ yearCode: "2526" }]];
      }
      if (sql.includes("INSERT INTO module_number_sequence")) {
        return [{}];
      }
      if (sql.includes("SELECT lastNumber FROM module_number_sequence") && sql.includes("FOR UPDATE")) {
        return [[{ lastNumber: NaN }]];
      }
      if (sql.includes("UPDATE module_number_sequence SET lastNumber")) {
        return [{}];
      }
      if (sql.includes("UPDATE accounts_loan_ac SET voucherNo")) {
        return [{}];
      }
      throw new Error(sql);
    });
    await assignAccountsLoanAcVoucherNo(conn, 1);
    const updateCalls = conn.query.mock.calls.filter((c) =>
      String(c[0]).includes("UPDATE accounts_loan_ac SET voucherNo")
    );
    expect(updateCalls[0][1][0]).toBe("LN/CR/2526/0001");
  });

  test("assertAccountsLoanAcRole2UnitAndCurrentAc enforces unit and NPA for role 2", async () => {
    const conn = createConn();
    conn.query.mockResolvedValue([[{ id: 10 }]]);

    await expect(
      assertAccountsLoanAcRole2UnitAndCurrentAc(
        conn,
        { unit: 9, npaCurrentAc: 10 },
        { role: 2, unit: 5 }
      )
    ).rejects.toMatchObject({ code: "ACCOUNTS_LOAN_AC_VALIDATION_FAILED" });

    conn.query.mockResolvedValueOnce([[]]);
    await expect(
      assertAccountsLoanAcRole2UnitAndCurrentAc(
        conn,
        { unit: 5, npaCurrentAc: 99 },
        { role: 2, unit: 5 }
      )
    ).rejects.toMatchObject({ code: "ACCOUNTS_LOAN_AC_VALIDATION_FAILED" });

    conn.query.mockResolvedValue([[{ id: 10 }]]);
    await expect(
      assertAccountsLoanAcRole2UnitAndCurrentAc(
        conn,
        { unit: 5, npaCurrentAc: 10 },
        { role: 2, unit: 5 }
      )
    ).resolves.toBeUndefined();
  });

  test("validateAccountsLoanAcBeforeWrite runs full assertion chain", async () => {
    const conn = createConn();
    conn.query.mockResolvedValue([[{ id: 1 }]]);
    await expect(
      validateAccountsLoanAcBeforeWrite(conn, {
        parentData: {
          transactionType: "Receipt",
          paymentMode: "Card",
          unit: 1,
          npaCurrentAc: 1,
          chequeNo: "",
          chequeDate: ""
        },
        user: { role: 1 }
      })
    ).resolves.toBeUndefined();
  });

  test("applyAccountsLoanAcBeforeWrite clears NPA on cash update with recordId", async () => {
    const conn = createConn();
    conn.query.mockResolvedValue([{}]);
    await applyAccountsLoanAcBeforeWrite(conn, {
      oldRow: {
        transactionType: "Receipt",
        paymentMode: "Card",
        unit: 1,
        npaCurrentAc: 5,
        chequeNo: "",
        chequeDate: null
      },
      merged: { paymentMode: "cash" },
      user: { role: 1 },
      recordId: 77
    });
    const npaUpdate = conn.query.mock.calls.find((c) =>
      String(c[0]).includes("SET npaCurrentAc = NULL")
    );
    expect(npaUpdate).toBeTruthy();
    expect(npaUpdate[1]).toEqual([77]);
  });
});
