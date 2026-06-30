// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `invoicesReceived`.
 * Run with: npm test
 */

// Replace real database, auth, and Next.js pieces with fakes so tests run offline.
jest.mock("../../config/modules", () => ({
  modules: {
    invoices_received: { table: "invoices_received" },
    recovery_invoice: { table: "recovery_invoice" },
    sarfaesi_invoice: { table: "sarfaesi_invoice" },
    vehicle_invoice: { table: "vehicle_invoice" },
    new_case_inward: { table: "new_case_inward" },
    financial_year_master: { table: "financial_year_master" }
  }
}));

jest.mock("../../lib/db", () => {
  const query = jest.fn();
  return {
    __esModule: true,
    default: { query },
    queryWithRetry: query
  };
});

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

jest.mock("../../lib/istDateTime", () => ({
  getYmdISTFromInstant: jest.fn(() => "2026-04-10")
}));

const pool = require("../../lib/db").default;
const { FREEZE_TRANSACTIONS_LOCKED_MESSAGE } = require("../../lib/modules/freezeTransactionsLock");
const {
  assignInvoicesReceivedRefNo,
  appendInvoicesReceivedRecoveryInvoicePickerFilter,
  enrichInvoicesReceivedInvoicePickerRows,
  invoicesReceivedInvoicePickerJoinParts,
  isInvoicesReceivedInvoicePickerList,
  normalizeInvoicesReceivedInvoiceFkFields,
  validateInvoicesReceivedBeforeWrite
} = require("../../lib/modules/invoicesReceived");

// Helper used by tests: createConn.
function createConn(routes = []) {
  return {
    query: jest.fn(async (sql, params = []) => {
      for (const r of routes) {
        if (r.when(sql, params)) {
          return typeof r.reply === "function" ? r.reply(sql, params) : r.reply;
        }
      }
      throw new Error(`Unexpected query:\n${sql}\nparams:${JSON.stringify(params)}`);
    })
  };
}

const fyFrozen = {
  when: (sql) => sql.includes("financial_year_master"),
  reply: [[{ freezeTransactions: "Yes" }]]
};

// Automated checks for: invoicesReceived module.
describe("invoicesReceived module", () => {
  test("assignInvoicesReceivedRefNo stamps IR/year/serial", async () => {
    const conn = createConn([
      {
        when: (sql) => sql.includes("FROM invoices_received"),
        reply: [[{ id: 1, receivedDate: "2026-04-10" }]]
      },
      {
        when: (sql) => sql.includes("financial_year_master"),
        reply: [[{ yearCode: "FY26" }]]
      },
      {
        when: (sql) => sql.includes("INSERT INTO module_number_sequence"),
        reply: [{ affectedRows: 1 }]
      },
      {
        when: (sql) => sql.includes("FOR UPDATE"),
        reply: [[{ lastNumber: 0 }]]
      },
      {
        when: (sql) => sql.includes("UPDATE module_number_sequence"),
        reply: [{ affectedRows: 1 }]
      },
      {
        when: (sql) => sql.includes("UPDATE invoices_received SET refNo"),
        reply: [{ affectedRows: 1 }]
      }
    ]);
    await assignInvoicesReceivedRefNo(conn, 1);
    const updates = conn.query.mock.calls.filter((c) => String(c[0]).includes("UPDATE invoices_received SET refNo"));
    expect(updates[0][1][0]).toBe("IR/FY26/0001");
  });

  test("appendInvoicesReceivedRecoveryInvoicePickerFilter adds NOT EXISTS and excludes cancelled", () => {
    const mysql = { escapeId: (n) => `\`${n}\`` };
    const whereParts = [];
    const whereValues = [];
    appendInvoicesReceivedRecoveryInvoicePickerFilter({
      mysql,
      mainTableRef: "`recovery_invoice`",
      whereParts,
      whereValues,
      parentRecordId: 5
    });
    expect(whereParts.join(" ")).toContain("NOT EXISTS");
    expect(whereParts.join(" ")).toContain("invoices_received");
    expect(whereParts.join(" ")).toContain("recoveryInvoice");
    expect(whereParts.join(" ")).toContain("cancelledInvoice");
    expect(whereValues).toContain(5);
    expect(whereValues).toContain("yes");
  });

  test("isInvoicesReceivedInvoicePickerList detects recovery picker param", () => {
    const params = new URLSearchParams({ invoices_received_recovery_picker: "1" });
    expect(isInvoicesReceivedInvoicePickerList("recovery_invoice", params)).toBe(true);
    expect(isInvoicesReceivedInvoicePickerList("sarfaesi_invoice", params)).toBe(false);
  });

  test("invoicesReceivedInvoicePickerJoinParts adds NCI borrower LEFT JOIN", () => {
    const parts = invoicesReceivedInvoicePickerJoinParts("`recovery_invoice`");
    expect(parts.selectExtra).toContain("borrower");
    expect(parts.fromJoin).toContain("new_case_inward");
    expect(parts.fromJoin).toContain("`recovery_invoice`");
    expect(parts.fromJoin).toContain("caseNo");
  });

  test("normalizeInvoicesReceivedInvoiceFkFields maps legacy 0 to null", () => {
    const row = { recoveryInvoice: 5, sarfaesiInvoice: 0, vehicleInvoice: "0" };
    normalizeInvoicesReceivedInvoiceFkFields(row);
    expect(row).toEqual({
      recoveryInvoice: 5,
      sarfaesiInvoice: null,
      vehicleInvoice: null
    });
  });

  test("enrichInvoicesReceivedInvoicePickerRows maps borrower from linked case", async () => {
    pool.query.mockResolvedValueOnce([
      [
        { id: 10, borrower: "Test Borrower" },
        { id: 11, borrower: "Other" }
      ]
    ]);
    const rows = [
      { id: 1, caseNo: 10 },
      { id: 2, caseNo: 11 },
      { id: 3, caseNo: null }
    ];
    await enrichInvoicesReceivedInvoicePickerRows(rows);
    expect(rows[0].borrower).toBe("Test Borrower");
    expect(rows[1].borrower).toBe("Other");
    expect(rows[2].borrower).toBe("");
    expect(String(pool.query.mock.calls[0][0])).toContain("new_case_inward");
  });

  test("rejects when no invoice selected", async () => {
    const conn = createConn([]);
    await expect(
      validateInvoicesReceivedBeforeWrite(conn, {
        parentData: { receivedDate: "2026-04-01" },
        parentRecordId: null,
        user: { role: 1 }
      })
    ).rejects.toMatchObject({
      code: "INVOICES_RECEIVED_VALIDATION_FAILED"
    });
  });

  test("rejects duplicate recovery invoice", async () => {
    const conn = createConn([
      {
        when: (sql) => sql.includes("FROM recovery_invoice WHERE id"),
        reply: [[{ id: 10 }]]
      },
      {
        when: (sql) => sql.includes("FROM invoices_received WHERE recoveryInvoice"),
        reply: [[{ id: 99 }]]
      }
    ]);
    await expect(
      validateInvoicesReceivedBeforeWrite(conn, {
        parentData: { receivedDate: "2026-04-01", recoveryInvoice: 10 },
        parentRecordId: null,
        user: { role: 1 }
      })
    ).rejects.toThrow(/already recorded/);
  });

  test("role 2 freeze on receivedDate", async () => {
    const conn = createConn([fyFrozen]);
    await expect(
      validateInvoicesReceivedBeforeWrite(conn, {
        parentData: { receivedDate: "2026-04-01", recoveryInvoice: 10 },
        parentRecordId: null,
        user: { role: 2 }
      })
    ).rejects.toThrow(FREEZE_TRANSACTIONS_LOCKED_MESSAGE);
  });
});

