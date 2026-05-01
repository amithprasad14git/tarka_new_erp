// Test file for validating app behavior and regression safety.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Comprehensive tests for lib/childTablesSync.js
 */

jest.mock("mysql2", () => ({
  escapeId: jest.fn((v) => `\`${String(v)}\``)
}));

const mysql = require("mysql2");
const { syncChildTablesInTransaction } = require("../../lib/childTablesSync");

function makeConn(impl) {
  return {
    query: jest.fn(impl || (async () => [{ affectedRows: 1 }]))
  };
}

function baseModuleConfig() {
  return {
    childTables: [
      {
        key: "amount_recovered",
        table: "new_case_inward_amount_recovered",
        parentFkField: "caseInwardId",
        label: "Amount Recovered",
        fields: [
          { name: "recoveredDate", type: "date", label: "Recovered Date", required: true },
          { name: "recoveredAmount", type: "number", label: "Recovered Amount", required: true }
        ]
      }
    ]
  };
}

describe("childTablesSync.syncChildTablesInTransaction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("valid child row insert: deletes existing then inserts row", async () => {
    const conn = makeConn();
    await expect(
      syncChildTablesInTransaction(conn, baseModuleConfig(), 101, {
        amount_recovered: [{ recoveredDate: "2026-04-10", recoveredAmount: "1250.50" }]
      })
    ).resolves.toBeUndefined();

    expect(conn.query).toHaveBeenNthCalledWith(
      1,
      "DELETE FROM `new_case_inward_amount_recovered` WHERE `caseInwardId` = ?",
      [101]
    );
    expect(conn.query).toHaveBeenNthCalledWith(
      2,
      "INSERT INTO `new_case_inward_amount_recovered` (`caseInwardId`, `recoveredDate`, `recoveredAmount`) VALUES (?, ?, ?)",
      [101, "2026-04-10", 1250.5]
    );
  });

  test("valid child row update (replace semantics): old rows deleted then new rows inserted", async () => {
    const conn = makeConn();
    await expect(
      syncChildTablesInTransaction(conn, baseModuleConfig(), 202, {
        amount_recovered: [
          { recoveredDate: "2026-04-11", recoveredAmount: 2000 },
          { recoveredDate: "2026-04-12", recoveredAmount: 3000 }
        ]
      })
    ).resolves.toBeUndefined();

    expect(conn.query.mock.calls[0][0]).toContain("DELETE FROM `new_case_inward_amount_recovered`");
    expect(conn.query.mock.calls.filter(([sql]) => sql.startsWith("INSERT INTO `new_case_inward_amount_recovered`")).length).toBe(
      2
    );
  });

  test("valid child row delete (replace semantics): empty array triggers delete only", async () => {
    const conn = makeConn();
    await expect(
      syncChildTablesInTransaction(conn, baseModuleConfig(), 303, {
        amount_recovered: []
      })
    ).resolves.toBeUndefined();

    expect(conn.query).toHaveBeenCalledTimes(1);
    expect(conn.query).toHaveBeenCalledWith(
      "DELETE FROM `new_case_inward_amount_recovered` WHERE `caseInwardId` = ?",
      [303]
    );
  });

  test("invalid child table name rejection", async () => {
    const conn = makeConn();
    const cfg = {
      childTables: [
        {
          key: "amount_recovered",
          // Intentionally missing `table` so assertChildTableAllowed receives empty name and rejects.
          fields: [{ name: "recoveredAmount", type: "number", required: true }]
        }
      ]
    };

    await expect(
      syncChildTablesInTransaction(conn, cfg, 1, {
        amount_recovered: [{ recoveredAmount: 10 }]
      })
    ).rejects.toMatchObject({ code: "CHILD_ROWS_INVALID" });
  });

  test("non-array child payload rejection", async () => {
    const conn = makeConn();
    await expect(
      syncChildTablesInTransaction(conn, baseModuleConfig(), 1, {
        amount_recovered: { recoveredDate: "2026-04-10" }
      })
    ).rejects.toMatchObject({ code: "CHILD_ROWS_INVALID" });
  });

  test("invalid row object rejection", async () => {
    const conn = makeConn();
    await expect(
      syncChildTablesInTransaction(conn, baseModuleConfig(), 1, {
        amount_recovered: [null]
      })
    ).rejects.toMatchObject({ code: "CHILD_ROWS_INVALID" });
  });

  test("required field validation", async () => {
    const conn = makeConn();
    await expect(
      syncChildTablesInTransaction(conn, baseModuleConfig(), 1, {
        amount_recovered: [{ recoveredDate: "", recoveredAmount: 100 }]
      })
    ).rejects.toThrow("Amount Recovered, row 1: Recovered Date is required.");
  });

  test("numeric field validation", async () => {
    const conn = makeConn();
    await expect(
      syncChildTablesInTransaction(conn, baseModuleConfig(), 1, {
        amount_recovered: [{ recoveredDate: "2026-04-10", recoveredAmount: "abc" }]
      })
    ).rejects.toThrow("Amount Recovered, row 1: Recovered Amount must be a valid number.");
  });

  test("orphan row rejection equivalent: unknown child key payload is ignored safely", async () => {
    const conn = makeConn();
    await expect(
      syncChildTablesInTransaction(conn, baseModuleConfig(), 1, {
        unknown_child: [{ a: 1 }]
      })
    ).resolves.toBeUndefined();
    expect(conn.query).not.toHaveBeenCalled();
  });

  test("transaction rollback integration signal: throws on database failure for caller rollback", async () => {
    const conn = makeConn(async (sql) => {
      if (sql.startsWith("INSERT INTO")) throw new Error("insert failed");
      return [{ affectedRows: 1 }];
    });

    await expect(
      syncChildTablesInTransaction(conn, baseModuleConfig(), 1, {
        amount_recovered: [{ recoveredDate: "2026-04-10", recoveredAmount: 10 }]
      })
    ).rejects.toThrow("insert failed");
  });

  test("null handling: empty string/undefined values coerce to null before insert", async () => {
    const conn = makeConn();
    await expect(
      syncChildTablesInTransaction(
        conn,
        {
          childTables: [
            {
              key: "line_items",
              table: "new_case_inward_amount_recovered",
              parentFkField: "caseInwardId",
              fields: [
                { name: "note", type: "text", required: false },
                { name: "lookupVal", type: "lookup", required: false },
                { name: "amount", type: "number", required: false }
              ]
            }
          ]
        },
        10,
        { line_items: [{ note: "", lookupVal: "", amount: undefined }] }
      )
    ).resolves.toBeUndefined();

    const insertCall = conn.query.mock.calls.find(([sql]) => sql.startsWith("INSERT INTO"));
    expect(insertCall[1]).toEqual([10, null, null, null]);
  });

  test("checkbox fields coerce to 0/1 before insert", async () => {
    const conn = makeConn();
    await expect(
      syncChildTablesInTransaction(
        conn,
        {
          childTables: [
            {
              key: "return_case_details",
              table: "return_case_details",
              parentFkField: "returnCaseId",
              fields: [
                { name: "select", type: "checkbox", required: false },
                { name: "returnReason", type: "lookup", required: true }
              ]
            }
          ]
        },
        10,
        { return_case_details: [{ select: true, returnReason: 3 }] }
      )
    ).resolves.toBeUndefined();

    const insertCall = conn.query.mock.calls.find(([sql]) => sql.startsWith("INSERT INTO"));
    expect(insertCall[1]).toEqual([10, 1, 3]);
  });

  test("checkbox undefined coerces to 0 (not null)", async () => {
    const conn = makeConn();
    await expect(
      syncChildTablesInTransaction(
        conn,
        {
          childTables: [
            {
              key: "return_case_details",
              table: "return_case_details",
              parentFkField: "returnCaseId",
              fields: [
                { name: "select", type: "checkbox", required: false },
                { name: "returnReason", type: "lookup", required: true }
              ]
            }
          ]
        },
        11,
        { return_case_details: [{ returnReason: 9 }] }
      )
    ).resolves.toBeUndefined();

    const insertCall = conn.query.mock.calls.find(([sql]) => sql.startsWith("INSERT INTO"));
    expect(insertCall[1]).toEqual([11, 0, 9]);
  });
});

