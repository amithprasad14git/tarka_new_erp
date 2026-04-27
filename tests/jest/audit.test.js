/**
 * Comprehensive tests for lib/audit.js
 */

jest.mock("../../lib/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn()
  }
}));

jest.mock("../../lib/istDateTime", () => ({
  formatInstantAsMysqlDatetimeIST: jest.fn(() => "2026-04-26 14:00:00")
}));

jest.mock("../../lib/sqlModuleTable", () => ({
  escapeSqlTableId: jest.fn(() => "`audit_logs`")
}));

const pool = require("../../lib/db").default;
const { formatInstantAsMysqlDatetimeIST } = require("../../lib/istDateTime");
const { writeAuditLog } = require("../../lib/audit");

describe("audit.writeAuditLog", () => {
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
      null,
      JSON.stringify(newData),
      99,
      "2026-04-26 14:00:00",
      99,
      "2026-04-26 14:00:00"
    ]);
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

    expect(pool.query.mock.calls[0][1][4]).toBe(JSON.stringify(oldData));
    expect(pool.query.mock.calls[0][1][5]).toBe(JSON.stringify(newData));
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
    expect(params[4]).toBe(JSON.stringify(oldData));
    expect(params[5]).toBeNull();
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
    expect(params[6]).toBe(123); // createdBy
    expect(params[8]).toBe(123); // modifiedBy
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
    expect(JSON.parse(params[4])).toEqual(oldData);
    expect(JSON.parse(params[5])).toEqual(newData);
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
    expect(params[6]).toBeNull();
    expect(params[8]).toBeNull();
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

