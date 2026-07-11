// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `sarfaesiCaseStatusUpdate`.
 * Run with: npm test
 */

// Test file for validating app behavior and regression safety.

// Replace real database, auth, and Next.js pieces with fakes so tests run offline.
jest.mock("../../config/modules", () => ({
  modules: {
    sarfaesi_case_status_update: { table: "sarfaesi_case_status_update" },
    sarfaesi_case_particulars: { table: "sarfaesi_case_particulars" },
    new_case_inward: { table: "new_case_inward" },
    lookup_value_master: { table: "lookup_value_master" },
    lookup_type_master: { table: "lookup_type_master" },
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

jest.mock("../../lib/modules/sarfaesiInvoice", () => ({
  appendSarfaesiInvoiceCasePickerLoanCategoryFilter: jest.fn(({ whereParts }) => {
    whereParts.push("LOAN_CATEGORY_FILTER");
  }),
  SARFAESI_INVOICE_LOAN_CATEGORY_LOOKUP_TYPE: "Loan Category",
  SARFAESI_INVOICE_LOAN_CATEGORY_LOOKUP_VALUE: "SARFAESI"
}));

const { FREEZE_TRANSACTIONS_LOCKED_MESSAGE } = require("../../lib/modules/freezeTransactionsLock");
const {
  assignSarfaesiCaseStatusUpdateRefNo,
  appendSarfaesiCaseStatusUpdateCasePickerFilter,
  validateSarfaesiCaseStatusUpdateBeforeWrite
} = require("../../lib/modules/sarfaesiCaseStatusUpdate");

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
  when: (sql) => sql.includes("freezeTransactions"),
  reply: [[{ freezeTransactions: "Yes" }]]
};

const validChildRows = {
  sarfaesi_case_status_update_details: [{ particulars: 10, remarks: "Done" }]
};

// Automated checks for: sarfaesiCaseStatusUpdate module.
describe("sarfaesiCaseStatusUpdate module", () => {
  test("assignSarfaesiCaseStatusUpdateRefNo stamps SRFUP/year/serial", async () => {
    const conn = createConn([
      {
        when: (sql) => sql.includes("FROM sarfaesi_case_status_update"),
        reply: [[{ id: 1, date: "2026-04-10" }]]
      },
      {
        when: (sql) => sql.includes("financial_year_master"),
        reply: [[{ yearCode: "FY26" }]]
      },
      {
        when: (sql) => sql.includes("INSERT INTO module_number_sequence"),
        reply: [{}]
      },
      {
        when: (sql) => sql.includes("SELECT lastNumber") && sql.includes("FOR UPDATE"),
        reply: [[{ lastNumber: 2 }]]
      },
      {
        when: (sql) => sql.includes("UPDATE module_number_sequence"),
        reply: [{}]
      },
      {
        when: (sql) => sql.includes("UPDATE sarfaesi_case_status_update SET refNo"),
        reply: [{}]
      }
    ]);

    await assignSarfaesiCaseStatusUpdateRefNo(conn, 1);
    const updateCalls = conn.query.mock.calls.filter((c) =>
      String(c[0]).includes("UPDATE sarfaesi_case_status_update SET refNo")
    );
    expect(updateCalls[0][1][0]).toBe("SRFUP/FY26/0003");
  });

  test("validateSarfaesiCaseStatusUpdateBeforeWrite blocks role 2 when FY frozen", async () => {
    const conn = createConn([fyFrozen]);
    await expect(
      validateSarfaesiCaseStatusUpdateBeforeWrite(conn, {
        parentData: { date: "2026-04-10", caseNo: 5 },
        childTableRows: validChildRows,
        user: { role: 2 }
      })
    ).rejects.toMatchObject({
      code: "SARFAESI_CASE_STATUS_UPDATE_VALIDATION_FAILED",
      message: FREEZE_TRANSACTIONS_LOCKED_MESSAGE
    });
  });

  test("validateSarfaesiCaseStatusUpdateBeforeWrite allows admin when FY frozen before other checks", async () => {
    const conn = createConn([
      fyFrozen,
      {
        when: (sql) => sql.includes("FROM new_case_inward") && sql.includes("loanCategory"),
        reply: [[{ id: 5 }]]
      },
      {
        when: (sql) => sql.includes("FROM sarfaesi_case_status_update") && sql.includes("caseNo"),
        reply: [[]]
      },
      {
        when: (sql) => sql.includes("SELECT id FROM new_case_inward WHERE id"),
        reply: [[{ id: 5 }]]
      },
      {
        when: (sql) => sql.includes("sarfaesi_case_particulars"),
        reply: [[{ id: 10 }]]
      }
    ]);

    await expect(
      validateSarfaesiCaseStatusUpdateBeforeWrite(conn, {
        parentData: { date: "2026-04-10", caseNo: 5 },
        childTableRows: validChildRows,
        user: { role: 1 }
      })
    ).resolves.toBeUndefined();
  });

  test("validateSarfaesiCaseStatusUpdateBeforeWrite allows empty remarks on detail rows", async () => {
    const conn = createConn([
      {
        when: (sql) => sql.includes("FROM new_case_inward") && sql.includes("loanCategory"),
        reply: [[{ id: 5 }]]
      },
      {
        when: (sql) => sql.includes("FROM sarfaesi_case_status_update") && sql.includes("caseNo"),
        reply: [[]]
      },
      {
        when: (sql) => sql.includes("SELECT id FROM new_case_inward WHERE id"),
        reply: [[{ id: 5 }]]
      },
      {
        when: (sql) => sql.includes("sarfaesi_case_particulars"),
        reply: [[{ id: 10 }]]
      }
    ]);

    await expect(
      validateSarfaesiCaseStatusUpdateBeforeWrite(conn, {
        parentData: { date: "2026-04-10", caseNo: 5 },
        childTableRows: {
          sarfaesi_case_status_update_details: [{ particulars: 10, remarks: "" }]
        },
        user: { role: 1 }
      })
    ).resolves.toBeUndefined();
  });

  test("validateSarfaesiCaseStatusUpdateBeforeWrite rejects duplicate caseNo", async () => {
    const conn = createConn([
      {
        when: (sql) => sql.includes("FROM new_case_inward") && sql.includes("loanCategory"),
        reply: [[{ id: 5 }]]
      },
      {
        when: (sql) => sql.includes("FROM sarfaesi_case_status_update") && sql.includes("caseNo"),
        reply: [[{ id: 99 }]]
      }
    ]);

    await expect(
      validateSarfaesiCaseStatusUpdateBeforeWrite(conn, {
        parentData: { date: "2026-04-10", caseNo: 5 },
        childTableRows: validChildRows,
        user: { role: 1 }
      })
    ).rejects.toMatchObject({ code: "SARFAESI_CASE_STATUS_UPDATE_VALIDATION_FAILED" });
  });

  test("appendSarfaesiCaseStatusUpdateCasePickerFilter adds loan filter and NOT EXISTS", () => {
    const whereParts = [];
    const whereValues = [];
    appendSarfaesiCaseStatusUpdateCasePickerFilter({
      mysql: { escapeId: (n) => `\`${n}\`` },
      mainTableRef: "`new_case_inward`",
      whereParts,
      whereValues,
      parentRecordId: null
    });
    expect(whereParts.some((p) => p === "LOAN_CATEGORY_FILTER")).toBe(true);
    expect(whereParts.some((p) => p.includes("NOT EXISTS"))).toBe(true);
  });
});


