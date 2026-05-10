// Test file for validating app behavior and regression safety.
// Keep module-specific business logic in lib/modules/<module> files.

jest.mock("../../config/modules", () => ({
  modules: {
    transfer_case: { table: "transfer_case" },
    new_case_inward: { table: "new_case_inward" },
    unit_master: { table: "unit_master" },
    financial_year_master: { table: "financial_year_master" }
  }
}));

jest.mock("../../lib/gridRowValue", () => ({
  rowValueForField: jest.fn((row, field) => (row && Object.prototype.hasOwnProperty.call(row, field) ? row[field] : null))
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

const {
  validateTransferCaseBeforeWrite,
  applyTransferCaseOwnershipInTransaction,
  assignTransferCaseRefNo
} = require("../../lib/modules/transferCase");

const fyFreezeNotLockedRoute = {
  when: (sql) => sql.includes("freezeTransactions") && sql.includes("financial_year_master"),
  reply: [[{ freezeTransactions: "No" }]]
};

function createConn(routes) {
  return {
    query: jest.fn(async (sql, params = []) => {
      for (const r of routes) {
        if (r.when(sql, params)) return typeof r.reply === "function" ? r.reply(sql, params) : r.reply;
      }
      throw new Error(`Unexpected query:\n${sql}\nparams:${JSON.stringify(params)}`);
    })
  };
}

describe("transferCase module", () => {
  test("validateTransferCaseBeforeWrite accepts valid payload", async () => {
    const conn = createConn([
      fyFreezeNotLockedRoute,
      {
        when: (sql) => sql.includes("FROM new_case_inward"),
        reply: [[{ id: 901, unit: 10 }]]
      },
      {
        when: (sql) => sql.includes("unit_master"),
        reply: [[{ id: 20 }]]
      },
      {
        when: (sql) => sql.includes("FROM users"),
        reply: [[{ id: 33 }]]
      }
    ]);

    await expect(
      validateTransferCaseBeforeWrite(conn, {
        parentData: { date: "2026-04-10", caseNo: 901, fromUnit: 10, toUnit: 20, assignee: 33 }
      })
    ).resolves.toBeUndefined();
  });

  test("validateTransferCaseBeforeWrite blocks same from/to unit", async () => {
    const conn = createConn([
      fyFreezeNotLockedRoute,
      {
        when: (sql) => sql.includes("FROM new_case_inward"),
        reply: [[{ id: 901, unit: 10 }]]
      }
    ]);

    await expect(
      validateTransferCaseBeforeWrite(conn, {
        parentData: { date: "2026-04-10", caseNo: 901, fromUnit: 10, toUnit: 10, assignee: 33 }
      })
    ).rejects.toMatchObject({
      code: "TRANSFER_CASE_VALIDATION_FAILED",
      message: "To Unit cannot be the same as From Unit."
    });
  });

  test("applyTransferCaseOwnershipInTransaction updates case ownership columns", async () => {
    let selectCount = 0;
    const conn = createConn([
      {
        when: (sql) => sql.startsWith("SELECT * FROM new_case_inward WHERE id = ? LIMIT 1"),
        reply: () => {
          selectCount += 1;
          if (selectCount === 1) return [[{ id: 88, unit: 3, createdBy: 5, modifiedBy: 5 }]];
          return [[{ id: 88, unit: 9, createdBy: 17, modifiedBy: 17 }]];
        }
      },
      {
        when: (sql) => sql.startsWith("UPDATE new_case_inward SET unit"),
        reply: [{ affectedRows: 1 }]
      }
    ]);

    const result = await applyTransferCaseOwnershipInTransaction(conn, { caseNo: 88, toUnit: 9, assignee: 17 });
    expect(conn.query).toHaveBeenCalledWith(
      "UPDATE new_case_inward SET unit = ?, createdBy = ?, modifiedBy = ? WHERE id = ?",
      [9, 17, 17, 88]
    );
    expect(result).toMatchObject({
      caseId: 88,
      oldCaseRow: { id: 88, unit: 3 },
      newCaseRow: { id: 88, unit: 9 }
    });
  });

  test("assignTransferCaseRefNo generates TRF/yearCode serial", async () => {
    const conn = createConn([
      {
        when: (sql) => sql.startsWith("SELECT id, date FROM transfer_case"),
        reply: [[{ id: 11, date: "2026-04-15" }]]
      },
      {
        when: (sql) => sql.includes("SELECT yearCode FROM financial_year_master"),
        reply: [[{ yearCode: "FY26" }]]
      },
      {
        when: (sql) => sql.startsWith("INSERT INTO module_number_sequence"),
        reply: [{}]
      },
      {
        when: (sql) => sql.startsWith("SELECT lastNumber FROM module_number_sequence"),
        reply: [[{ lastNumber: 41 }]]
      },
      {
        when: (sql) => sql.startsWith("UPDATE module_number_sequence SET lastNumber"),
        reply: [{}]
      },
      {
        when: (sql) => sql.startsWith("UPDATE transfer_case SET refNo"),
        reply: [{}]
      }
    ]);

    await assignTransferCaseRefNo(conn, 11);
    expect(conn.query).toHaveBeenCalledWith(
      "UPDATE transfer_case SET refNo = ? WHERE id = ? AND (refNo IS NULL OR TRIM(refNo) = '')",
      ["TRF/FY26/00042", 11]
    );
  });
});

