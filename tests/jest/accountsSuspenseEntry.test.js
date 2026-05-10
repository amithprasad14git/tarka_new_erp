// Test file for validating app behavior and regression safety.
// Keep module-specific business logic in lib/modules/<module> files.

jest.mock("../../config/modules", () => ({
  modules: {
    accounts_suspense_entry: { table: "accounts_suspense_entry" },
    financial_year_master: { table: "financial_year_master" }
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
  assignAccountsSuspenseEntryVoucherNo,
  ACCOUNTS_SUSPENSE_ENTRY_MODULE_KEY,
  ACCOUNTS_SUSPENSE_ENTRY_POST_CREATE_ACK_CONFIG
} = require("../../lib/modules/accountsSuspenseEntry");

describe("accountsSuspenseEntry module", () => {
  test("assignAccountsSuspenseEntryVoucherNo stamps SUSP/<year>/<serial>", async () => {
    const conn = { query: jest.fn() };

    conn.query.mockImplementation(async (sql) => {
      if (sql.includes("FROM accounts_suspense_entry WHERE id")) {
        return [[{ id: 1, date: "2026-03-01" }]];
      }
      if (sql.includes("financial_year_master")) {
        return [[{ yearCode: "2526" }]];
      }
      if (sql.includes("INSERT INTO module_number_sequence")) {
        return [{}];
      }
      if (sql.includes("SELECT lastNumber FROM module_number_sequence") && sql.includes("FOR UPDATE")) {
        return [[{ lastNumber: 4 }]];
      }
      if (sql.includes("UPDATE module_number_sequence SET lastNumber")) {
        return [{}];
      }
      if (sql.includes("UPDATE accounts_suspense_entry SET voucherNo")) {
        return [{}];
      }
      throw new Error(`Unexpected query:\n${sql}`);
    });

    await assignAccountsSuspenseEntryVoucherNo(conn, 1);

    const updateCalls = conn.query.mock.calls.filter((c) =>
      String(c[0]).includes("UPDATE accounts_suspense_entry SET voucherNo")
    );
    expect(updateCalls[0][1][0]).toBe("SUSP/2526/0005");

    expect(ACCOUNTS_SUSPENSE_ENTRY_MODULE_KEY).toBe("accounts_suspense_entry");
    expect(ACCOUNTS_SUSPENSE_ENTRY_POST_CREATE_ACK_CONFIG.field).toBe("voucherNo");
  });

  test("assignAccountsSuspenseEntryVoucherNo rejects when row missing", async () => {
    const conn = {
      query: jest.fn(async (sql) => {
        if (sql.includes("FROM accounts_suspense_entry WHERE id")) {
          return [[]];
        }
        throw new Error(sql);
      })
    };

    await expect(assignAccountsSuspenseEntryVoucherNo(conn, 999)).rejects.toMatchObject({
      code: "ACCOUNTS_SUSPENSE_ENTRY_VALIDATION_FAILED"
    });
  });

  test("assignAccountsSuspenseEntryVoucherNo rejects when date cannot be resolved for FY", async () => {
    sqlDateFieldValue.toYyyyMmDdForSqlDateField.mockReturnValueOnce("");
    const conn = { query: jest.fn() };
    conn.query.mockImplementation(async (sql) => {
      if (sql.includes("FROM accounts_suspense_entry WHERE id")) {
        return [[{ id: 1, date: "" }]];
      }
      throw new Error(sql);
    });
    await expect(assignAccountsSuspenseEntryVoucherNo(conn, 1)).rejects.toMatchObject({
      code: "ACCOUNTS_SUSPENSE_ENTRY_VALIDATION_FAILED"
    });
    sqlDateFieldValue.toYyyyMmDdForSqlDateField.mockImplementation((value) =>
      String(value || "").slice(0, 10)
    );
  });

  test("assignAccountsSuspenseEntryVoucherNo rejects when no financial year matches date", async () => {
    const conn = { query: jest.fn() };
    conn.query.mockImplementation(async (sql) => {
      if (sql.includes("FROM accounts_suspense_entry WHERE id")) {
        return [[{ id: 1, date: "2026-03-01" }]];
      }
      if (sql.includes("financial_year_master")) {
        return [[{ yearCode: "   " }]];
      }
      throw new Error(sql);
    });
    await expect(assignAccountsSuspenseEntryVoucherNo(conn, 1)).rejects.toMatchObject({
      code: "ACCOUNTS_SUSPENSE_ENTRY_VALIDATION_FAILED"
    });
  });

  test("assignAccountsSuspenseEntryVoucherNo rejects when sequence row missing", async () => {
    const conn = { query: jest.fn() };
    conn.query.mockImplementation(async (sql) => {
      if (sql.includes("FROM accounts_suspense_entry WHERE id")) {
        return [[{ id: 1, date: "2026-03-01" }]];
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
    await expect(assignAccountsSuspenseEntryVoucherNo(conn, 1)).rejects.toMatchObject({
      code: "ACCOUNTS_SUSPENSE_ENTRY_VALIDATION_FAILED"
    });
  });

  test("assignAccountsSuspenseEntryVoucherNo uses next=1 when lastNumber is non-finite", async () => {
    const conn = { query: jest.fn() };
    conn.query.mockImplementation(async (sql) => {
      if (sql.includes("FROM accounts_suspense_entry WHERE id")) {
        return [[{ id: 2, date: "2026-03-01" }]];
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
      if (sql.includes("UPDATE accounts_suspense_entry SET voucherNo")) {
        return [{}];
      }
      throw new Error(sql);
    });
    await assignAccountsSuspenseEntryVoucherNo(conn, 2);
    const updateCalls = conn.query.mock.calls.filter((c) =>
      String(c[0]).includes("UPDATE accounts_suspense_entry SET voucherNo")
    );
    expect(updateCalls[0][1][0]).toBe("SUSP/2526/0001");
  });
});
