// Test file for validating app behavior and regression safety.
// Keep module-specific business logic in lib/modules/<module> files.

jest.mock("../../config/modules", () => ({
  modules: {
    public_notice: { table: "public_notice" },
    new_case_inward: { table: "new_case_inward" },
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
  getYmdISTFromInstant: jest.fn(() => "2026-04-30")
}));

const { validatePublicNoticeBeforeWrite, assignPublicNoticeRefNo } = require("../../lib/modules/publicNotice");

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

describe("publicNotice module", () => {
  test("validatePublicNoticeBeforeWrite passes for valid payload", async () => {
    const conn = createConn([
      fyFreezeNotLockedRoute,
      {
        when: (sql) => sql.includes("FROM new_case_inward"),
        reply: [[{ id: 15 }]]
      }
    ]);

    await expect(
      validatePublicNoticeBeforeWrite(conn, {
        parentData: { date: "2026-04-30", caseNo: 15 },
        childTableRows: { public_notice_details: [{ displayName: "ABC Traders", type: 1, address: "Mysuru" }] }
      })
    ).resolves.toBeUndefined();
  });

  test("validatePublicNoticeBeforeWrite requires one display name", async () => {
    const conn = createConn([fyFreezeNotLockedRoute]);
    await expect(
      validatePublicNoticeBeforeWrite(conn, {
        parentData: { date: "2026-04-30", caseNo: 15 },
        childTableRows: { public_notice_details: [{ displayName: "   ", type: 1 }] }
      })
    ).rejects.toMatchObject({ code: "PUBLIC_NOTICE_VALIDATION_FAILED" });
  });

  test("validatePublicNoticeBeforeWrite blocks more than 3 rows", async () => {
    const conn = createConn([
      fyFreezeNotLockedRoute,
      {
        when: (sql) => sql.includes("FROM new_case_inward"),
        reply: [[{ id: 15 }]]
      }
    ]);
    await expect(
      validatePublicNoticeBeforeWrite(conn, {
        parentData: { date: "2026-04-30", caseNo: 15 },
        childTableRows: {
          public_notice_details: [
            { displayName: "A", type: 1 },
            { displayName: "B", type: 1 },
            { displayName: "C", type: 1 },
            { displayName: "D", type: 1 }
          ]
        }
      })
    ).rejects.toMatchObject({ code: "PUBLIC_NOTICE_VALIDATION_FAILED" });
  });

  test("assignPublicNoticeRefNo generates PN/year serial", async () => {
    const conn = createConn([
      {
        when: (sql) => sql.startsWith("SELECT id, date FROM public_notice"),
        reply: [[{ id: 8, date: "2026-04-30" }]]
      },
      {
        when: (sql) => sql.includes("SELECT yearCode FROM financial_year_master"),
        reply: [[{ yearCode: "FY26" }]]
      },
      { when: (sql) => sql.startsWith("INSERT INTO module_number_sequence"), reply: [{}] },
      { when: (sql) => sql.startsWith("SELECT lastNumber FROM module_number_sequence"), reply: [[{ lastNumber: 7 }]] },
      { when: (sql) => sql.startsWith("UPDATE module_number_sequence SET lastNumber"), reply: [{}] },
      { when: (sql) => sql.startsWith("UPDATE public_notice SET refNo"), reply: [{}] }
    ]);

    await assignPublicNoticeRefNo(conn, 8);
    expect(conn.query).toHaveBeenCalledWith(
      "UPDATE public_notice SET refNo = ? WHERE id = ? AND (refNo IS NULL OR TRIM(refNo) = '')",
      ["PN/FY26/00008", 8]
    );
  });
});

