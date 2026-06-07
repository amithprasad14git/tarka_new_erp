// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `audit`.
 * Run with: npm test
 */

// Test file for validating app behavior and regression safety.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Comprehensive tests for lib/audit.js
 */

// Replace real database, auth, and Next.js pieces with fakes so tests run offline.
jest.mock("../../lib/db", () => {
  const query = jest.fn();
  return {
    __esModule: true,
    default: { query },
    queryWithRetry: (sql, values) => query(sql, values)
  };
});

jest.mock("../../lib/istDateTime", () => ({
  formatInstantAsMysqlDatetimeIST: jest.fn(() => "2026-04-26 14:00:00")
}));

jest.mock("../../lib/sqlModuleTable", () => ({
  escapeSqlTableId: jest.fn(() => "`audit_logs`")
}));

jest.mock("../../config/modules", () => ({
  modules: {
    sample_module: {
      lookupDisplayField: "name",
      fields: [{ name: "name", label: "Name" }]
    }
  }
}));

const pool = require("../../lib/db").default;
const { formatInstantAsMysqlDatetimeIST } = require("../../lib/istDateTime");
const { pickAuditUpdateSnapshots, writeAuditLog, buildAuditRecordLabel } = require("../../lib/audit");

// Checks the system records who changed what and shows it in a readable way.
describe("pickAuditUpdateSnapshots", () => {
  test("returns only keys that differ", () => {
    const oldRow = { id: 1, a: 1, b: "x", c: 3 };
    const newRow = { id: 1, a: 2, b: "x", c: 3 };
    expect(pickAuditUpdateSnapshots(oldRow, newRow)).toEqual({
      oldData: { a: 1 },
      newData: { a: 2 }
    });
  });

  test("returns empty objects when rows are identical", () => {
    const r = { id: 1, n: 1 };
    expect(pickAuditUpdateSnapshots(r, r)).toEqual({ oldData: {}, newData: {} });
  });

  test("includes key when it appears only on one side", () => {
    expect(
      pickAuditUpdateSnapshots({ id: 1 }, { id: 1, added: 9 })
    ).toEqual({ oldData: { added: undefined }, newData: { added: 9 } });
  });
});

// Checks the system records who changed what and shows it in a readable way.
describe("audit.writeAuditLog", () => {
  // Reset mocks and default stubs before each example runs.
  beforeEach(() => {
    jest.clearAllMocks();
    pool.query.mockResolvedValue([{ affectedRows: 1 }]);
  });

  test("create audit log writes expected row (old_data null, new_data serialized)", async () => {
    const newData = { id: 1, name: "Created Row" };
    await expect(
      writeAuditLog({
        userId: 99,
        moduleName: "sample_module",
        action: "create",
        recordId: 1,
        oldData: null,
        newData
      })
    ).resolves.toBeUndefined();

    expect(formatInstantAsMysqlDatetimeIST).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0][1]).toEqual([
      99,
      "sample_module",
      "create",
      1,
      "Created Row",
      null,
      JSON.stringify(newData),
      99,
      "2026-04-26 14:00:00",
      99,
      "2026-04-26 14:00:00"
    ]);
  });

  test("writeAuditLog stores explicit recordLabel", async () => {
    await writeAuditLog({
      userId: 1,
      moduleName: "sample_module",
      action: "update",
      recordId: 2,
      recordLabel: "INV/2627/0001",
      oldData: { x: 1 },
      newData: { x: 2 }
    });
    expect(pool.query.mock.calls[0][1][4]).toBe("INV/2627/0001");
  });

  test("update audit log writes both old_data and new_data serialized", async () => {
    const oldData = { id: 2, amount: 100 };
    const newData = { id: 2, amount: 250 };
    await writeAuditLog({
      userId: 9,
      moduleName: "sample_module",
      action: "update",
      recordId: 2,
      oldData,
      newData
    });

    expect(pool.query.mock.calls[0][1][4]).toBe("Record #2");
    expect(pool.query.mock.calls[0][1][5]).toBe(JSON.stringify(oldData));
    expect(pool.query.mock.calls[0][1][6]).toBe(JSON.stringify(newData));
    expect(pool.query.mock.calls[0][1][2]).toBe("update");
  });

  test("delete audit log writes new_data as null", async () => {
    const oldData = { id: 3, status: "deleted" };
    await writeAuditLog({
      userId: 7,
      moduleName: "sample_module",
      action: "delete",
      recordId: 3,
      oldData,
      newData: null
    });

    const params = pool.query.mock.calls[0][1];
    expect(params[5]).toBe(JSON.stringify(oldData));
    expect(params[6]).toBeNull();
    expect(params[2]).toBe("delete");
  });

  test("actor metadata capture duplicates uid in createdBy/modifiedBy", async () => {
    await writeAuditLog({
      userId: 123,
      moduleName: "sample_module",
      action: "update",
      recordId: 5,
      oldData: { x: 1 },
      newData: { x: 2 }
    });

    const params = pool.query.mock.calls[0][1];
    expect(params[0]).toBe(123); // user_id
    expect(params[7]).toBe(123); // createdBy
    expect(params[9]).toBe(123); // modifiedBy
  });

  test("payload serialization persists JSON snapshots", async () => {
    const oldData = { nested: { a: 1 }, arr: [1, 2, 3] };
    const newData = { nested: { a: 2 }, arr: [1, 2, 3, 4] };
    await writeAuditLog({
      userId: 11,
      moduleName: "sample_module",
      action: "update",
      recordId: 8,
      oldData,
      newData
    });

    const params = pool.query.mock.calls[0][1];
    expect(JSON.parse(params[5])).toEqual(oldData);
    expect(JSON.parse(params[6])).toEqual(newData);
  });

  test("null actor handling stores null in user/actor columns", async () => {
    await writeAuditLog({
      userId: null,
      moduleName: "sample_module",
      action: "create",
      recordId: 10,
      oldData: null,
      newData: { id: 10 }
    });

    const params = pool.query.mock.calls[0][1];
    expect(params[0]).toBeNull();
    expect(params[7]).toBeNull();
    expect(params[9]).toBeNull();
  });

  test("malformed payload handling: circular JSON throws before DB insert", async () => {
    const circular = { id: 1 };
    circular.self = circular;

    await expect(
      writeAuditLog({
        userId: 1,
        moduleName: "sample_module",
        action: "update",
        recordId: 1,
        oldData: circular,
        newData: { ok: true }
      })
    ).rejects.toThrow();

    expect(pool.query).not.toHaveBeenCalled();
  });

  test("database insert failure handling propagates DB error", async () => {
    pool.query.mockRejectedValueOnce(new Error("insert audit failed"));

    await expect(
      writeAuditLog({
        userId: 1,
        moduleName: "sample_module",
        action: "create",
        recordId: 1,
        oldData: null,
        newData: { id: 1 }
      })
    ).rejects.toThrow("insert audit failed");
  });
});


