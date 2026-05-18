// Test file for validating app behavior and regression safety.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Comprehensive tests for lib/services/crud.service.js
 */

jest.mock("../../config/modules", () => ({
  modules: {
    sample_module: {
      table: "sample_table",
      fields: [
        { name: "name", type: "text", required: true },
        { name: "amount", type: "number", required: true }
      ]
    },
    readonly_module: {
      table: "readonly_table",
      readOnly: true,
      fields: [{ name: "name", type: "text" }]
    },
    child_module: {
      table: "child_parent",
      fields: [{ name: "name", type: "text", required: true }],
      childTables: [{ key: "lines", table: "child_lines", fields: [{ name: "v", type: "number", required: true }] }]
    },
    ack_module: {
      table: "ack_table",
      postCreateAck: { field: "refNo" },
      fields: [
        { name: "name", type: "text", required: true },
        { name: "refNo", type: "text", required: false, excludeFromForm: true }
      ]
    },
    new_case_inward: {
      table: "nci",
      fields: [{ name: "loanAccountNo", type: "text", required: true }],
      childTables: [{ key: "amount_recovered", table: "new_case_inward_amount_recovered", fields: [] }]
    }
  }
}));

jest.mock("../../lib/db", () => {
  const query = jest.fn();
  return {
    __esModule: true,
    default: {
      query,
      getConnection: jest.fn()
    },
    queryWithRetry: (sql, values) => query(sql, values)
  };
});

jest.mock("../../lib/rbac", () => ({
  hasModulePermission: jest.fn(),
  getScopeForAction: jest.fn()
}));

jest.mock("../../lib/rowScope", () => ({
  annotateRowsModifyAccess: jest.fn(),
  canUserModifyRow: jest.fn(),
  rowMatchesScope: jest.fn()
}));

jest.mock("../../lib/crudLookupEnrich", () => ({
  enrichLookupDisplayRows: jest.fn()
}));

jest.mock("../../lib/childTablesLoad", () => ({
  loadChildTableRowsForParent: jest.fn()
}));

jest.mock("../../lib/audit", () => ({
  writeAuditLog: jest.fn(),
  buildAuditRecordLabel: jest.fn((_moduleKey, row, recordId) => {
    if (row?.name != null && String(row.name).trim() !== "") return String(row.name).trim();
    return recordId != null ? `Record #${recordId}` : "";
  }),
  pickAuditUpdateSnapshots: jest.fn((oldRow, newRow) => {
    if (oldRow == null || newRow == null) {
      return { oldData: oldRow ?? null, newData: newRow ?? null };
    }
    if (typeof oldRow !== "object" || typeof newRow !== "object") {
      return { oldData: oldRow, newData: newRow };
    }
    const keys = new Set([...Object.keys(oldRow), ...Object.keys(newRow)]);
    const oldData = {};
    const newData = {};
    for (const k of keys) {
      const ov = Object.prototype.hasOwnProperty.call(oldRow, k) ? oldRow[k] : undefined;
      const nv = Object.prototype.hasOwnProperty.call(newRow, k) ? newRow[k] : undefined;
      try {
        if (JSON.stringify(ov) !== JSON.stringify(nv)) {
          oldData[k] = ov;
          newData[k] = nv;
        }
      } catch {
        oldData[k] = ov;
        newData[k] = nv;
      }
    }
    return { oldData, newData };
  })
}));

jest.mock("../../lib/crudNormalize", () => ({
  normalizeCrudPayload: jest.fn((body) => ({ ...body }))
}));

jest.mock("../../lib/crudRecordAudit", () => ({
  applyCreateAudit: jest.fn((body) => ({ ...body, createdBy: 99, createdDate: "d1", modifiedBy: 99, modifiedDate: "d1" })),
  applyUpdateAudit: jest.fn((body) => ({ ...body, modifiedBy: 99, modifiedDate: "d2" })),
  getAuditColumnNames: jest.fn(() => ({
    createdBy: "createdBy",
    createdAt: "createdDate",
    modifiedBy: "modifiedBy",
    modifiedAt: "modifiedDate"
  })),
  moduleHasRowAuditFields: jest.fn(() => false),
  stripClientAuditFields: jest.fn((b) => ({ ...b }))
}));

jest.mock("../../lib/sqlModuleTable", () => ({
  escapeSqlTableIdForModuleConfig: jest.fn((cfg) => cfg.table)
}));

jest.mock("../../lib/moduleAfterCreate", () => ({
  runAfterCreateInTransaction: jest.fn()
}));

jest.mock("../../lib/services/crudPayloadValidation", () => ({
  validateCrudPayloadForWrite: jest.fn(() => null)
}));

jest.mock("../../lib/childTablesSync", () => ({
  syncChildTablesInTransaction: jest.fn()
}));

jest.mock("../../lib/modules/newCaseInward", () => ({
  applyRole2FinalStageEditLock: jest.fn(),
  isNewCaseInwardFinalStatusById: jest.fn(),
  validateNewCaseInwardBeforeWrite: jest.fn(),
  assertNewCaseInwardRowEditableByUser: jest.fn(),
  applyNewCaseInwardBeforeWrite: jest.fn(),
  applyNewCaseInwardGetByIdLocks: jest.fn()
}));

const pool = require("../../lib/db").default;
const { hasModulePermission } = require("../../lib/rbac");
const { getScopeForAction } = require("../../lib/rbac");
const { canUserModifyRow, rowMatchesScope, annotateRowsModifyAccess } = require("../../lib/rowScope");
const { enrichLookupDisplayRows } = require("../../lib/crudLookupEnrich");
const { loadChildTableRowsForParent } = require("../../lib/childTablesLoad");
const { writeAuditLog } = require("../../lib/audit");
const { validateCrudPayloadForWrite } = require("../../lib/services/crudPayloadValidation");
const { syncChildTablesInTransaction } = require("../../lib/childTablesSync");
const {
  stripClientAuditFields,
  moduleHasRowAuditFields,
  applyCreateAudit,
  applyUpdateAudit
} = require("../../lib/crudRecordAudit");
const {
  applyRole2FinalStageEditLock,
  isNewCaseInwardFinalStatusById,
  validateNewCaseInwardBeforeWrite,
  assertNewCaseInwardRowEditableByUser,
  applyNewCaseInwardBeforeWrite,
  applyNewCaseInwardGetByIdLocks
} = require("../../lib/modules/newCaseInward");
const {
  createCrudRecord,
  updateCrudRecord,
  deleteCrudRecord,
  getCrudRecordById
} = require("../../lib/services/crud.service");

function makeTxConn() {
  return {
    beginTransaction: jest.fn(async () => {}),
    query: jest.fn(async () => [{ insertId: 123 }]),
    commit: jest.fn(async () => {}),
    rollback: jest.fn(async () => {}),
    release: jest.fn()
  };
}

describe("crud.service", () => {
  const user = { id: 99, role: 2, unit: 1 };
  /** Keep expected error-path tests from polluting Jest output. */
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear any leftover mockResolvedValueOnce queues between tests.
    pool.query.mockReset();
    pool.getConnection.mockReset();
    hasModulePermission.mockReset();
    getScopeForAction.mockReset();
    canUserModifyRow.mockReset();
    rowMatchesScope.mockReset();
    annotateRowsModifyAccess.mockReset();
    loadChildTableRowsForParent.mockReset();
    enrichLookupDisplayRows.mockReset();
    validateNewCaseInwardBeforeWrite.mockReset();
    assertNewCaseInwardRowEditableByUser.mockReset();
    applyNewCaseInwardBeforeWrite.mockReset();
    applyNewCaseInwardGetByIdLocks.mockReset();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("createCrudRecord", () => {
    test("successful create", async () => {
      hasModulePermission.mockResolvedValueOnce(true);
      pool.getConnection.mockResolvedValueOnce(makeTxConn());
      pool.query.mockResolvedValueOnce([[{ id: 123, name: "A" }]]);

      const result = await createCrudRecord(user, "sample_module", { name: "A", amount: 100 });
      expect(result.status).toBe(200);
      expect(result.body).toMatchObject({ ok: true, id: 123 });
      expect(writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: "create", moduleName: "sample_module", recordId: 123 })
      );
    });

    test("unknown module rejection", async () => {
      const result = await createCrudRecord(user, "missing_module", { name: "A" });
      expect(result).toEqual({ status: 404, body: { error: "Unknown module" } });
    });

    test("read-only module rejection", async () => {
      const result = await createCrudRecord(user, "readonly_module", { name: "A" });
      expect(result).toEqual({ status: 400, body: { error: "Read-only module" } });
    });

    test("permission denied", async () => {
      hasModulePermission.mockResolvedValueOnce(false);
      const result = await createCrudRecord(user, "sample_module", { name: "A", amount: 10 });
      expect(result).toEqual({ status: 403, body: { error: "Forbidden" } });
    });

    test("invalid payload rejection from validator", async () => {
      hasModulePermission.mockResolvedValueOnce(true);
      validateCrudPayloadForWrite.mockReturnValueOnce("Name is required.");
      const result = await createCrudRecord(user, "sample_module", { name: "", amount: 10 });
      expect(result).toEqual({ status: 400, body: { error: "Name is required." } });
    });

    test("child table synchronization is called for child module", async () => {
      hasModulePermission.mockResolvedValueOnce(true);
      const conn = makeTxConn();
      pool.getConnection.mockResolvedValueOnce(conn);
      pool.query.mockResolvedValueOnce([[{ id: 123, name: "A" }]]);
      stripClientAuditFields.mockReturnValueOnce({ name: "A", childTableRows: { lines: [{ v: 10 }] } });

      await createCrudRecord(user, "child_module", { name: "A", childTableRows: { lines: [{ v: 10 }] } });
      expect(syncChildTablesInTransaction).toHaveBeenCalledWith(
        conn,
        expect.objectContaining({ table: "child_parent" }),
        123,
        { lines: [{ v: 10 }] }
      );
    });

    test("database transaction rollback on failure", async () => {
      hasModulePermission.mockResolvedValueOnce(true);
      const conn = makeTxConn();
      conn.query.mockRejectedValueOnce(new Error("insert failed"));
      pool.getConnection.mockResolvedValueOnce(conn);

      const result = await createCrudRecord(user, "sample_module", { name: "A", amount: 10 });
      expect(result).toEqual({ status: 500, body: { error: "Failed to create record" } });
      expect(conn.rollback).toHaveBeenCalled();
      expect(conn.release).toHaveBeenCalled();
    });

    test("duplicate key handling (generic DB error path)", async () => {
      hasModulePermission.mockResolvedValueOnce(true);
      const conn = makeTxConn();
      const dup = new Error("Duplicate entry");
      dup.code = "ER_DUP_ENTRY";
      conn.query.mockRejectedValueOnce(dup);
      pool.getConnection.mockResolvedValueOnce(conn);

      const result = await createCrudRecord(user, "sample_module", { name: "A", amount: 10 });
      expect(result.status).toBe(500);
      expect(result.body.error).toBe("Failed to create record");
      expect(conn.rollback).toHaveBeenCalled();
    });

    test("create rejects when no valid fields to insert", async () => {
      hasModulePermission.mockResolvedValueOnce(true);
      const result = await createCrudRecord(user, "sample_module", { unknown: "x" });
      expect(result).toEqual({ status: 400, body: { error: "No valid fields to insert" } });
    });

    test("create applies row-audit fields when module supports them", async () => {
      hasModulePermission.mockResolvedValueOnce(true);
      moduleHasRowAuditFields.mockReturnValueOnce(true);
      const conn = makeTxConn();
      pool.getConnection.mockResolvedValueOnce(conn);
      pool.query.mockResolvedValueOnce([[{ id: 123, name: "A" }]]);

      await createCrudRecord(user, "sample_module", { name: "A", amount: 1 });
      expect(applyCreateAudit).toHaveBeenCalled();
    });

    test("create returns postCreateAck payload when configured field has value", async () => {
      hasModulePermission.mockResolvedValueOnce(true);
      const conn = makeTxConn();
      pool.getConnection.mockResolvedValueOnce(conn);
      pool.query.mockResolvedValueOnce([[{ id: 123, name: "A", refNo: "REF-001" }]]);
      conn.query.mockResolvedValueOnce([{ insertId: 123 }]);

      const result = await createCrudRecord(user, "ack_module", { name: "A" });
      expect(result.status).toBe(200);
      expect(result.body.postCreateAck).toEqual({ field: "refNo", value: "REF-001" });
    });

    test("new_case_inward create forwards admin date-validation bypass flag", async () => {
      const admin = { id: 1, role: 1, unit: 1 };
      hasModulePermission.mockResolvedValueOnce(true);
      const conn = makeTxConn();
      pool.getConnection.mockResolvedValueOnce(conn);
      pool.query.mockResolvedValueOnce([[{ id: 123, loanAccountNo: "123456" }]]);

      await createCrudRecord(admin, "new_case_inward", { loanAccountNo: "123456" });

      expect(applyNewCaseInwardBeforeWrite).toHaveBeenCalledWith(
        conn,
        expect.objectContaining({
          user: admin,
          merged: expect.objectContaining({ loanAccountNo: "123456" }),
          childTableRows: undefined,
          parentId: null
        })
      );
    });
  });

  describe("updateCrudRecord", () => {
    test("successful update", async () => {
      hasModulePermission.mockResolvedValueOnce(true);
      pool.query
        .mockResolvedValueOnce([[{ id: 1, name: "Old", amount: 50 }]]) // existing
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // update
        .mockResolvedValueOnce([[{ id: 1, name: "New", amount: 100 }]]); // refreshed row
      canUserModifyRow.mockResolvedValueOnce(true);

      const result = await updateCrudRecord(user, "sample_module", 1, async () => ({ name: "New", amount: 100 }));
      expect(result).toEqual({ status: 200, body: { ok: true } });
      expect(writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: "update", moduleName: "sample_module", recordId: 1 })
      );
    });

    test("row scope denied", async () => {
      hasModulePermission.mockResolvedValueOnce(true);
      pool.query.mockResolvedValueOnce([[{ id: 1, createdBy: 77 }]]);
      canUserModifyRow.mockResolvedValueOnce(false);
      const result = await updateCrudRecord(user, "sample_module", 1, async () => ({ name: "x" }));
      expect(result).toEqual({ status: 403, body: { error: "Forbidden" } });
    });

    test("invalid payload rejection", async () => {
      hasModulePermission.mockResolvedValueOnce(true);
      pool.query.mockResolvedValueOnce([[{ id: 1, name: "Old" }]]);
      canUserModifyRow.mockResolvedValueOnce(true);
      validateCrudPayloadForWrite.mockReturnValueOnce("Amount must be valid.");

      const result = await updateCrudRecord(user, "sample_module", 1, async () => ({ amount: "abc" }));
      expect(result).toEqual({ status: 400, body: { error: "Amount must be valid." } });
    });

    test("child table update path performs transaction + sync", async () => {
      hasModulePermission.mockResolvedValueOnce(true);
      pool.query.mockResolvedValueOnce([[{ id: 1, name: "Old" }]]);
      canUserModifyRow.mockResolvedValueOnce(true);
      const conn = makeTxConn();
      pool.getConnection.mockResolvedValueOnce(conn);
      pool.query.mockResolvedValueOnce([[{ id: 1, name: "New" }]]);

      const result = await updateCrudRecord(user, "child_module", 1, async () => ({
        name: "New",
        childTableRows: { lines: [{ v: 1 }] }
      }));
      expect(result.status).toBe(200);
      expect(syncChildTablesInTransaction).toHaveBeenCalledWith(
        conn,
        expect.objectContaining({ table: "child_parent" }),
        1,
        { lines: [{ v: 1 }] }
      );
      expect(conn.commit).toHaveBeenCalled();
    });

    test("database transaction rollback on child sync failure", async () => {
      hasModulePermission.mockResolvedValueOnce(true);
      pool.query.mockResolvedValueOnce([[{ id: 1, name: "Old" }]]);
      canUserModifyRow.mockResolvedValueOnce(true);
      const conn = makeTxConn();
      syncChildTablesInTransaction.mockRejectedValueOnce(Object.assign(new Error("bad child"), { code: "CHILD_ROWS_INVALID" }));
      pool.getConnection.mockResolvedValueOnce(conn);

      const result = await updateCrudRecord(user, "child_module", 1, async () => ({
        name: "New",
        childTableRows: { lines: [{ v: 1 }] }
      }));
      expect(result).toEqual({ status: 400, body: { error: "bad child" } });
      expect(conn.rollback).toHaveBeenCalled();
      expect(conn.release).toHaveBeenCalled();
    });

    test("update rejects when no valid fields to update", async () => {
      hasModulePermission.mockResolvedValueOnce(true);
      pool.query.mockResolvedValueOnce([[{ id: 1, name: "Old" }]]);
      canUserModifyRow.mockResolvedValueOnce(true);
      const result = await updateCrudRecord(user, "sample_module", 1, async () => ({ unknown: 1 }));
      expect(result).toEqual({ status: 400, body: { error: "No valid fields to update" } });
    });

    test("update applies row-audit fields when module supports them", async () => {
      hasModulePermission.mockResolvedValueOnce(true);
      moduleHasRowAuditFields.mockReturnValueOnce(true);
      pool.query
        .mockResolvedValueOnce([[{ id: 1, name: "Old", amount: 5 }]])
        .mockResolvedValueOnce([{ affectedRows: 1 }])
        .mockResolvedValueOnce([[{ id: 1, name: "New", amount: 5 }]]);
      canUserModifyRow.mockResolvedValueOnce(true);

      await updateCrudRecord(user, "sample_module", 1, async () => ({ name: "New", amount: 5 }));
      expect(applyUpdateAudit).toHaveBeenCalled();
    });

    test("new_case_inward role-2 final-stage edit lock denial", async () => {
      const role2 = { ...user, role: 2 };
      hasModulePermission.mockResolvedValueOnce(true);
      pool.query.mockResolvedValueOnce([[{ id: 1, caseStatus: 999, loanAccountNo: "123" }]]);
      canUserModifyRow.mockResolvedValueOnce(true);
      const conn = makeTxConn();
      pool.getConnection.mockResolvedValueOnce(conn);
      assertNewCaseInwardRowEditableByUser.mockRejectedValueOnce(
        Object.assign(new Error("Final-stage cases cannot be edited."), { code: "NCI_EDIT_LOCKED" })
      );

      const result = await updateCrudRecord(role2, "new_case_inward", 1, async () => ({ loanAccountNo: "123" }));
      expect(result).toEqual({ status: 403, body: { error: "Final-stage cases cannot be edited." } });
      expect(conn.release).toHaveBeenCalled();
    });

    test("new_case_inward update forwards non-admin date-validation flag as false", async () => {
      const role2 = { ...user, role: 2 };
      hasModulePermission.mockResolvedValueOnce(true);
      pool.query
        .mockResolvedValueOnce([[{ id: 1, caseStatus: 999, loanAccountNo: "123" }]])
        .mockResolvedValueOnce([[{ id: 1, caseStatus: 999, loanAccountNo: "123" }]]);
      canUserModifyRow.mockResolvedValueOnce(true);
      const finalCheckConn = makeTxConn();
      const txConn = makeTxConn();
      pool.getConnection.mockResolvedValueOnce(finalCheckConn).mockResolvedValueOnce(txConn);

      const result = await updateCrudRecord(role2, "new_case_inward", 1, async () => ({ loanAccountNo: "123" }));

      expect(result).toEqual({ status: 200, body: { ok: true } });
      expect(applyNewCaseInwardBeforeWrite).toHaveBeenCalledWith(
        txConn,
        expect.objectContaining({
          user: role2,
          oldRow: expect.objectContaining({ id: 1 }),
          merged: expect.objectContaining({ loanAccountNo: "123" }),
          parentId: 1
        })
      );
    });

    test("new_case_inward update forwards admin date-validation bypass flag", async () => {
      const admin = { ...user, id: 1, role: 1 };
      hasModulePermission.mockResolvedValueOnce(true);
      pool.query
        .mockResolvedValueOnce([[{ id: 1, caseStatus: 999, loanAccountNo: "123" }]])
        .mockResolvedValueOnce([[{ id: 1, caseStatus: 999, loanAccountNo: "123" }]]);
      canUserModifyRow.mockResolvedValueOnce(true);
      const preCheckConn = makeTxConn();
      const txConn = makeTxConn();
      pool.getConnection.mockResolvedValueOnce(preCheckConn).mockResolvedValueOnce(txConn);

      const result = await updateCrudRecord(admin, "new_case_inward", 1, async () => ({ loanAccountNo: "123" }));

      expect(result).toEqual({ status: 200, body: { ok: true } });
      expect(applyNewCaseInwardBeforeWrite).toHaveBeenCalledWith(
        txConn,
        expect.objectContaining({
          user: admin,
          oldRow: expect.objectContaining({ id: 1 }),
          merged: expect.objectContaining({ loanAccountNo: "123" }),
          parentId: 1
        })
      );
    });
  });

  describe("deleteCrudRecord", () => {
    test("successful delete + audit log", async () => {
      hasModulePermission.mockResolvedValueOnce(true);
      pool.query
        .mockResolvedValueOnce([[{ id: 1, name: "ToDelete" }]]) // existing
        .mockResolvedValueOnce([{ affectedRows: 1 }]); // delete
      canUserModifyRow.mockResolvedValueOnce(true);

      const result = await deleteCrudRecord(user, "sample_module", 1);
      expect(result).toEqual({ status: 200, body: { ok: true } });
      expect(writeAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: "delete", moduleName: "sample_module", recordId: 1 })
      );
    });

    test("permission denied", async () => {
      hasModulePermission.mockResolvedValueOnce(false);
      const result = await deleteCrudRecord(user, "sample_module", 1);
      expect(result).toEqual({ status: 403, body: { error: "Forbidden" } });
    });

    test("delete unknown module rejection", async () => {
      const result = await deleteCrudRecord(user, "missing_module", 1);
      expect(result).toEqual({ status: 404, body: { error: "Unknown module" } });
    });

    test("delete read-only module rejection", async () => {
      const result = await deleteCrudRecord(user, "readonly_module", 1);
      expect(result).toEqual({ status: 400, body: { error: "Read-only module" } });
    });

    test("delete returns 404 when row not found", async () => {
      hasModulePermission.mockResolvedValueOnce(true);
      pool.query.mockResolvedValueOnce([[]]);
      const result = await deleteCrudRecord(user, "sample_module", 1);
      expect(result).toEqual({ status: 404, body: { error: "Record not found" } });
    });

    test("delete row scope denied", async () => {
      hasModulePermission.mockResolvedValueOnce(true);
      pool.query.mockResolvedValueOnce([[{ id: 1, createdBy: 77 }]]);
      canUserModifyRow.mockResolvedValueOnce(false);
      const result = await deleteCrudRecord(user, "sample_module", 1);
      expect(result).toEqual({ status: 403, body: { error: "Forbidden" } });
    });
  });

  describe("getCrudRecordById", () => {
    test("returns 404 for unknown module", async () => {
      const result = await getCrudRecordById(user, "missing_module", 1);
      expect(result).toEqual({ status: 404, body: { error: "Unknown module" } });
    });

    test("returns 403 when both view and edit are denied", async () => {
      hasModulePermission.mockResolvedValueOnce(false).mockResolvedValueOnce(false);
      const result = await getCrudRecordById(user, "sample_module", 1);
      expect(result).toEqual({ status: 403, body: { error: "Forbidden" } });
    });

    test("returns 404 when record not found", async () => {
      hasModulePermission.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      pool.query.mockResolvedValueOnce([[]]);
      const result = await getCrudRecordById(user, "sample_module", 1);
      expect(result).toEqual({ status: 404, body: { error: "Record not found" } });
    });

    test("returns 404 when row scope denies record", async () => {
      hasModulePermission.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      pool.query.mockResolvedValueOnce([[{ id: 1, name: "A" }]]);
      getScopeForAction.mockResolvedValueOnce("own");
      rowMatchesScope.mockResolvedValueOnce(false);
      const result = await getCrudRecordById(user, "sample_module", 1);
      expect(result).toEqual({ status: 404, body: { error: "Record not found" } });
    });

    test("successful get by id with child rows and row annotations", async () => {
      hasModulePermission
        .mockResolvedValueOnce(true) // view
        .mockResolvedValueOnce(true) // edit
        .mockResolvedValueOnce(true); // delete
      pool.query.mockResolvedValueOnce([[{ id: 5, name: "A" }]]);
      getScopeForAction.mockResolvedValueOnce("all");
      rowMatchesScope.mockResolvedValueOnce(true);
      loadChildTableRowsForParent.mockResolvedValueOnce({ lines: [{ id: 1, v: 10 }] });

      const result = await getCrudRecordById(user, "child_module", 5);
      expect(result.status).toBe(200);
      expect(result.body).toEqual({
        data: { id: 5, name: "A" },
        childTableRows: { lines: [{ id: 1, v: 10 }] }
      });
      expect(enrichLookupDisplayRows).toHaveBeenCalled();
      expect(annotateRowsModifyAccess).toHaveBeenCalled();
    });

    test("new_case_inward role-2 path applies final-stage lock annotation", async () => {
      const role2 = { ...user, role: 2 };
      hasModulePermission
        .mockResolvedValueOnce(true) // view
        .mockResolvedValueOnce(true) // edit
        .mockResolvedValueOnce(false); // delete
      pool.query.mockResolvedValueOnce([[{ id: 7, caseStatus: 10 }]]);
      getScopeForAction.mockResolvedValueOnce("all");
      rowMatchesScope.mockResolvedValueOnce(true);
      const conn = makeTxConn();
      pool.getConnection.mockResolvedValueOnce(conn);

      const result = await getCrudRecordById(role2, "new_case_inward", 7);
      expect(result.status).toBe(200);
      expect(applyNewCaseInwardGetByIdLocks).toHaveBeenCalledWith(
        conn,
        role2,
        expect.objectContaining({ id: 7 })
      );
      expect(conn.release).toHaveBeenCalled();
    });
  });
});

