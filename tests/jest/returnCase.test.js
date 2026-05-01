// Test file for validating app behavior and regression safety.
// Keep module-specific business logic in lib/modules/<module> files.

jest.mock("../../config/modules", () => ({
  modules: {
    return_case: { table: "return_case" },
    new_case_inward: { table: "new_case_inward" },
    lookup_value_master: { table: "lookup_value_master" },
    financial_year_master: { table: "financial_year_master" }
  }
}));

/** DB routes when validation reaches case status + duplicate checks successfully. */
const validateCaseStatusAndDupOk = [
  {
    when: (sql) => /\bnew_case_inward\b/i.test(sql) && /\blookup_value_master\b/i.test(sql),
    reply: [[{ caseStatusLabel: "Returned" }]]
  },
  {
    when: (sql) => /\bFROM\b.*\breturn_case\b/i.test(sql) && /\bcaseNo\b/.test(sql),
    reply: [[]]
  }
];

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
  getYmdISTFromInstant: jest.fn(() => "2026-04-30")
}));

const { validateReturnCaseBeforeWrite, assignReturnCaseRefNo } = require("../../lib/modules/returnCase");

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

describe("returnCase module", () => {
  const validChildPayload = () => ({
    return_case_details: [{ select: 1, returnReason: "Borrower mismatch in documents" }]
  });

  test("validateReturnCaseBeforeWrite passes for valid payload", async () => {
    const conn = createConn(validateCaseStatusAndDupOk);

    await expect(
      validateReturnCaseBeforeWrite(conn, {
        parentData: { date: "2026-04-30", caseNo: 15 },
        childTableRows: validChildPayload()
      })
    ).resolves.toBeUndefined();
  });

  test("validateReturnCaseBeforeWrite rejects future date", async () => {
    const conn = createConn([]);
    await expect(
      validateReturnCaseBeforeWrite(conn, {
        parentData: { date: "2099-01-01", caseNo: 15 },
        childTableRows: validChildPayload()
      })
    ).rejects.toMatchObject({ code: "RETURN_CASE_VALIDATION_FAILED" });
  });

  test("validateReturnCaseBeforeWrite rejects missing case", async () => {
    const conn = createConn([
      {
        when: (sql) => /\bnew_case_inward\b/i.test(sql) && /\blookup_value_master\b/i.test(sql),
        reply: [[]]
      }
    ]);

    await expect(
      validateReturnCaseBeforeWrite(conn, {
        parentData: { date: "2026-04-30", caseNo: 15 },
        childTableRows: validChildPayload()
      })
    ).rejects.toMatchObject({ code: "RETURN_CASE_VALIDATION_FAILED" });
  });

  test("validateReturnCaseBeforeWrite requires at least one selected row", async () => {
    const conn = createConn([]);
    await expect(
      validateReturnCaseBeforeWrite(conn, {
        parentData: { date: "2026-04-30", caseNo: 15 },
        childTableRows: { return_case_details: [{ select: 0, returnReason: "Some reason" }] }
      })
    ).rejects.toMatchObject({ code: "RETURN_CASE_VALIDATION_FAILED" });
  });

  test("validateReturnCaseBeforeWrite rejects empty return reason when row is selected", async () => {
    const conn = createConn([]);
    await expect(
      validateReturnCaseBeforeWrite(conn, {
        parentData: { date: "2026-04-30", caseNo: 15 },
        childTableRows: { return_case_details: [{ select: 1, returnReason: "  " }] }
      })
    ).rejects.toMatchObject({ code: "RETURN_CASE_VALIDATION_FAILED" });
  });

  test("validateReturnCaseBeforeWrite rejects non-Returned case status", async () => {
    const conn = createConn([
      {
        when: (sql) => /\bnew_case_inward\b/i.test(sql) && /\blookup_value_master\b/i.test(sql),
        reply: [[{ caseStatusLabel: "Open" }]]
      }
    ]);
    await expect(
      validateReturnCaseBeforeWrite(conn, {
        parentData: { date: "2026-04-30", caseNo: 15 },
        childTableRows: validChildPayload()
      })
    ).rejects.toMatchObject({ code: "RETURN_CASE_VALIDATION_FAILED" });
  });

  test("validateReturnCaseBeforeWrite rejects duplicate caseNo on another Return Case", async () => {
    const conn = createConn([
      {
        when: (sql) => /\bnew_case_inward\b/i.test(sql) && /\blookup_value_master\b/i.test(sql),
        reply: [[{ caseStatusLabel: "Returned" }]]
      },
      {
        when: (sql, params) => /\bFROM\b.*\breturn_case\b/i.test(sql) && /\bcaseNo\b/.test(sql) && params?.[0] === 15,
        reply: [[{ id: 99 }]]
      }
    ]);
    await expect(
      validateReturnCaseBeforeWrite(conn, {
        parentData: { date: "2026-04-30", caseNo: 15 },
        childTableRows: validChildPayload()
      })
    ).rejects.toMatchObject({ code: "RETURN_CASE_VALIDATION_FAILED" });
  });

  test("validateReturnCaseBeforeWrite allows same caseNo when updating that Return Case row", async () => {
    const conn = createConn([
      {
        when: (sql) => /\bnew_case_inward\b/i.test(sql) && /\blookup_value_master\b/i.test(sql),
        reply: [[{ caseStatusLabel: "Returned" }]]
      },
      {
        when: (sql, params) =>
          /\bFROM\b.*\breturn_case\b/i.test(sql) &&
          /\bcaseNo\b/.test(sql) &&
          params?.[0] === 15 &&
          params?.[1] === 42,
        reply: [[]]
      }
    ]);
    await expect(
      validateReturnCaseBeforeWrite(conn, {
        parentData: { date: "2026-04-30", caseNo: 15 },
        childTableRows: validChildPayload(),
        parentRecordId: 42
      })
    ).resolves.toBeUndefined();
  });

  test("assignReturnCaseRefNo generates RETURN/yearCode serial", async () => {
    const conn = createConn([
      {
        when: (sql) => sql.startsWith("SELECT id, date FROM return_case"),
        reply: [[{ id: 8, date: "2026-04-30" }]]
      },
      {
        when: (sql) => sql.includes("SELECT yearCode FROM financial_year_master"),
        reply: [[{ yearCode: "FY26" }]]
      },
      { when: (sql) => sql.startsWith("INSERT INTO module_number_sequence"), reply: [{}] },
      { when: (sql) => sql.startsWith("SELECT lastNumber FROM module_number_sequence"), reply: [[{ lastNumber: 7 }]] },
      { when: (sql) => sql.startsWith("UPDATE module_number_sequence SET lastNumber"), reply: [{}] },
      { when: (sql) => sql.startsWith("UPDATE return_case SET refNo"), reply: [{}] }
    ]);

    await assignReturnCaseRefNo(conn, 8);
    expect(conn.query).toHaveBeenCalledWith(
      "UPDATE return_case SET refNo = ? WHERE id = ? AND (refNo IS NULL OR TRIM(refNo) = '')",
      ["RETURN/FY26/00008", 8]
    );
  });
});
