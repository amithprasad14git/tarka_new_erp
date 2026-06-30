/** @jest-environment node */

jest.mock("../../config/modules", () => ({
  modules: {
    new_case_inward: { table: "new_case_inward", fields: [{ name: "unit" }] },
    unit_master: { table: "unit_master", fields: [{ name: "unitName" }] },
    current_account_master: { table: "current_account_master", fields: [{ name: "branch" }] }
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

const { rowValueForField } = require("../../lib/gridRowValue");

function createConn(routes) {
  const query = jest.fn(async (sql, params) => {
    for (const route of routes) {
      if (route.when(sql, params)) return route.reply;
    }
    throw new Error(`Unexpected query: ${sql}`);
  });
  return { query };
}

const {
  INVOICE_UNIT_2_ID,
  INVOICE_NPA_UNIT_2_ID,
  INVOICE_NPA_DEFAULT_ID,
  resolveInvoiceNpaCurrentAcByCaseId
} = require("../../lib/modules/invoiceNpaCurrentAc");

describe("invoiceNpaCurrentAc", () => {
  test("exports unit 2 → NPA id 2 mapping constants", () => {
    expect(INVOICE_UNIT_2_ID).toBe(2);
    expect(INVOICE_NPA_UNIT_2_ID).toBe(2);
    expect(INVOICE_NPA_DEFAULT_ID).toBe(1);
  });

  test("resolveInvoiceNpaCurrentAcByCaseId uses NPA id 2 when case unit is 2", async () => {
    const conn = createConn([
      {
        when: (sql) => sql.includes("new_case_inward") && sql.includes("unit"),
        reply: [[{ unit: 2 }]]
      },
      {
        when: (sql, params) => sql.includes("unit_master") && params?.[0] === 2,
        reply: [[{ unitName: "Unit Two" }]]
      },
      {
        when: (sql, params) => sql.includes("current_account_master") && params?.[0] === 2,
        reply: [[{ id: 2, branch: "SBI Siddartha Nagar, Mysore" }]]
      }
    ]);

    await expect(resolveInvoiceNpaCurrentAcByCaseId(conn, 100)).resolves.toEqual({
      npaCurrentAc: "2",
      npaCurrentAcLabel: "SBI Siddartha Nagar, Mysore",
      billToUnit: "2",
      billToUnitLabel: "Unit Two"
    });
    expect(rowValueForField).toHaveBeenCalled();
  });

  test("resolveInvoiceNpaCurrentAcByCaseId uses NPA id 1 for other units", async () => {
    const conn = createConn([
      {
        when: (sql) => sql.includes("new_case_inward") && sql.includes("unit"),
        reply: [[{ unit: 1 }]]
      },
      {
        when: (sql, params) => sql.includes("unit_master") && params?.[0] === 1,
        reply: [[{ unitName: "Unit One" }]]
      },
      {
        when: (sql, params) => sql.includes("current_account_master") && params?.[0] === 1,
        reply: [[{ id: 1, branch: "SBI Siddartha Layout, Mysore" }]]
      }
    ]);

    await expect(resolveInvoiceNpaCurrentAcByCaseId(conn, 50)).resolves.toEqual({
      npaCurrentAc: "1",
      npaCurrentAcLabel: "SBI Siddartha Layout, Mysore",
      billToUnit: "1",
      billToUnitLabel: "Unit One"
    });
  });

  test("resolveInvoiceNpaCurrentAcByCaseId returns empty for invalid case id", async () => {
    const conn = createConn([]);
    await expect(resolveInvoiceNpaCurrentAcByCaseId(conn, 0)).resolves.toEqual({
      npaCurrentAc: "",
      npaCurrentAcLabel: "",
      billToUnit: "",
      billToUnitLabel: ""
    });
    expect(conn.query).not.toHaveBeenCalled();
  });
});

describe("recoveryInvoice NPA re-export", () => {
  test("resolveRecoveryInvoiceNpaCurrentAcByCaseId delegates to shared resolver", async () => {
    const { resolveRecoveryInvoiceNpaCurrentAcByCaseId } = require("../../lib/modules/recoveryInvoice");
    const conn = createConn([
      {
        when: (sql) => sql.includes("new_case_inward"),
        reply: [[{ unit: 2 }]]
      },
      {
        when: (sql, params) => sql.includes("unit_master") && params?.[0] === 2,
        reply: [[{ unitName: "Unit Two" }]]
      },
      {
        when: (sql, params) => sql.includes("current_account_master") && params?.[0] === 2,
        reply: [[{ id: 2, branch: "SBI Siddartha Nagar, Mysore" }]]
      }
    ]);
    await expect(resolveRecoveryInvoiceNpaCurrentAcByCaseId(conn, 10)).resolves.toEqual({
      npaCurrentAc: "2",
      npaCurrentAcLabel: "SBI Siddartha Nagar, Mysore",
      billToUnit: "2",
      billToUnitLabel: "Unit Two"
    });
  });
});
