jest.mock("../../config/modules", () => ({
  modules: {
    invoices_received: { table: "invoices_received" },
    recovery_invoice: { table: "recovery_invoice" },
    sarfaesi_invoice: { table: "sarfaesi_invoice" },
    vehicle_invoice: { table: "vehicle_invoice" },
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

jest.mock("../../lib/istDateTime", () => ({
  getYmdISTFromInstant: jest.fn(() => "2026-04-10")
}));

const { FREEZE_TRANSACTIONS_LOCKED_MESSAGE } = require("../../lib/modules/freezeTransactionsLock");
const {
  assignInvoicesReceivedRefNo,
  appendInvoicesReceivedRecoveryInvoicePickerFilter,
  validateInvoicesReceivedBeforeWrite
} = require("../../lib/modules/invoicesReceived");

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

  test("appendInvoicesReceivedRecoveryInvoicePickerFilter adds NOT EXISTS", () => {
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
    expect(whereValues).toContain(5);
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
