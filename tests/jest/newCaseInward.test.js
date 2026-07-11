// Test file — automated checks so changes do not break existing behaviour.

// Test file for validating app behavior and regression safety.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Comprehensive unit + integration tests for New Case Inward domain rules.
 *
 * Target: lib/modules/newCaseInward.js
 */

// Replace real database, auth, and Next.js pieces with fakes so tests run offline.
jest.mock("../../config/modules", () => ({
  modules: {
    lookup_value_master: { table: "lookup_value_master" },
    financial_year_master: { table: "financial_year_master" },
    new_case_inward_transaction_control: { table: "new_case_inward_transaction_control" },
    new_case_inward: { table: "new_case_inward" },
    branch_master: { table: "branch_master" },
    rbo_master: { table: "rbo_master" },
    ho_zo_master: { table: "ho_zo_master" },
    bank_master: { table: "bank_master" }
  }
}));

jest.mock("../../lib/modules/newCaseInwardCaseStatus", () => {
  const norm = (v) => String(v ?? "").trim().toLowerCase();
  return {
    normalizeNciCaseStatusLabel: norm,
    FINAL_CASE_STATUS_SET: new Set(
      ["Closed", "Settled under Compromise", "Regularized/Upgraded", "Auctioned", "Returned"].map(norm)
    ),
    REOPEN_ALLOWED_FINAL_CASE_STATUS_SET: new Set(
      ["Closed", "Settled under Compromise", "Regularized/Upgraded", "Auctioned"].map(norm)
    ),
    CASE_STATUS_REQUIRES_RECOVERY_SET: new Set(
      ["Closed", "Settled under Compromise", "Regularized/Upgraded", "Auctioned", "Part Recovery"].map(norm)
    )
  };
});

jest.mock("../../lib/gridRowValue", () => ({
  rowValueForField: jest.fn((row, field) => (row && Object.prototype.hasOwnProperty.call(row, field) ? row[field] : null))
}));

jest.mock("../../lib/istDateTime", () => ({
  getYmdISTFromInstant: jest.fn(() => "2026-04-10"),
  subtractCalendarDaysFromYmd: jest.fn((ymd, days) => {
    const m = String(ymd ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return "";
    const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    dt.setUTCDate(dt.getUTCDate() - Math.max(0, Math.floor(Number(days) || 0)));
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
  })
}));

jest.mock("../../lib/sqlDateFieldValue", () => ({
  toYyyyMmDdForSqlDateField: jest.fn((value) => {
    if (value == null || value === "") return "";
    const m = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
  })
}));

jest.mock("../../lib/sqlModuleTable", () => ({
  escapeSqlTableId: jest.fn((name) => name),
  escapeSqlTableIdForModuleConfig: jest.fn((cfg) => cfg?.table || "")
}));

const {
  resolveNewCaseInwardBankRuleByBranch,
  isNewCaseInwardFinalStatusById,
  applyRole2FinalStageEditLock,
  assignNewCaseInwardCaseNo,
  validateNewCaseInwardBeforeWrite,
  buildCaseNoSequencePrefix,
  normalizeCaseNoBankPrefix
} = require("../../lib/modules/newCaseInward");

// Helper used by tests: createConn.
function createConn(routes) {
  return {
    query: jest.fn(async (sql, params = []) => {
      for (const r of routes) {
        if (r.when(sql, params)) {
          return typeof r.reply === "function" ? r.reply(sql, params) : r.reply;
        }
      }
      throw new Error(`Unexpected query:\n${sql}\nparams: ${JSON.stringify(params)}`);
    })
  };
}

// Helper used by tests: baseRoutes.
function baseRoutes(overrides = {}) {
  const duplicateRows = overrides.duplicateRows || [];
  const txnRows = overrides.txnRows || [];
  const snapshotParentRows = overrides.snapshotParentRows || [];
  const snapshotChildRows = overrides.snapshotChildRows || [];
  const bankRows =
    overrides.bankRows ||
    [
      {
        bankId: 7,
        bankName: "Test Bank",
        loanAccountNoLength: overrides.loanAccountNoLength ?? null
      }
    ];
  const caseStatusLookupValue = overrides.caseStatusLookupValue ?? "";
  const sumRecovered = overrides.sumRecovered ?? 0;
  const fyRows = overrides.fyRows || [];

  return [
    {
      when: (sql) =>
        /SELECT\s+id\s+FROM\s+lookup_value_master/i.test(sql) &&
        sql.includes("active") &&
        sql.includes("Yes"),
      reply: [[{ id: 1 }]]
    },
    {
      when: (sql) =>
        /SELECT\s+id\s+FROM\s+branch_master/i.test(sql) && sql.includes("active") && sql.includes("Yes"),
      reply: [[{ id: 1 }]]
    },
    {
      when: (sql) => sql.includes("FROM new_case_inward nci") && sql.includes("LEFT JOIN lookup_value_master"),
      reply: [duplicateRows]
    },
    {
      when: (sql) =>
        sql.includes("SELECT freezeTransactions") &&
        sql.includes("FROM financial_year_master") &&
        sql.includes("BETWEEN startDate AND endDate"),
      reply: [fyRows]
    },
    {
      when: (sql) => sql.includes("SELECT field_name, allow_flag, days, is_active FROM new_case_inward_transaction_control"),
      reply: [txnRows]
    },
    {
      when: (sql) =>
        sql.includes("SELECT entrustmentDate, caseStatusUpdatedDate FROM new_case_inward WHERE id = ? LIMIT 1"),
      reply: [snapshotParentRows]
    },
    {
      when: (sql) => sql.includes("SELECT id, recoveredDate FROM new_case_inward_amount_recovered WHERE caseInwardId = ?"),
      reply: [snapshotChildRows]
    },
    {
      when: (sql) => sql.includes("FROM branch_master br") && sql.includes("INNER JOIN bank_master bm"),
      reply: [bankRows]
    },
    {
      when: (sql) => sql.includes("SELECT lookupValue FROM lookup_value_master WHERE id = ? LIMIT 1"),
      reply: [[{ lookupValue: caseStatusLookupValue }]]
    },
    {
      when: (sql) => sql.includes("SELECT COALESCE(SUM(recoveredAmount), 0) AS totalRecovered"),
      reply: [[{ totalRecovered: sumRecovered }]]
    }
  ];
}

// Automated checks for: newCaseInward module.
describe("newCaseInward module", () => {
  /**
   * Coverage note:
   * `LOAN_CATEGORY_CASE_NO_MAP_MISSING` is a defensive branch when the label map is empty.
   * The map is hardcoded non-empty in production code and not exported for mutation.
   */
// Automated checks for: resolveNewCaseInwardBankRuleByBranch.
  describe("resolveNewCaseInwardBankRuleByBranch", () => {
    test("returns null for non-numeric branch id", async () => {
      const conn = createConn([]);
      await expect(resolveNewCaseInwardBankRuleByBranch(conn, "abc")).resolves.toBeNull();
      expect(conn.query).not.toHaveBeenCalled();
    });

    test("returns normalized bank rule", async () => {
      const conn = createConn([
        {
          when: () => true,
          reply: [[{ bankId: "11", bankName: "SBI", loanAccountNoLength: "12" }]]
        }
      ]);

      await expect(resolveNewCaseInwardBankRuleByBranch(conn, 20)).resolves.toEqual({
        bankId: 11,
        bankName: "SBI",
        loanAccountNoLength: 12
      });
    });
  });

// Automated checks for: final-stage helpers.
  describe("final-stage helpers", () => {
    test("isNewCaseInwardFinalStatusById returns true for final statuses", async () => {
      const conn = createConn([
        {
          when: () => true,
          reply: [[{ lookupValue: "Closed" }]]
        }
      ]);
      await expect(isNewCaseInwardFinalStatusById(conn, 10)).resolves.toBe(true);
    });

    test("applyRole2FinalStageEditLock marks only final status rows as non-editable", async () => {
      const rows = [{ id: 1, caseStatus: 100 }, { id: 2, caseStatus: 101 }, { id: 3, caseStatus: null }];
      const conn = createConn([
        {
          when: (sql) => sql.includes("SELECT id, lookupValue FROM lookup_value_master WHERE id IN"),
          reply: [[{ id: 100, lookupValue: "Returned" }, { id: 101, lookupValue: "In Progress" }]]
        }
      ]);

      await applyRole2FinalStageEditLock(conn, rows);
      expect(rows[0]._canEdit).toBe(false);
      expect(rows[1]._canEdit).toBeUndefined();
      expect(rows[2]._canEdit).toBeUndefined();
    });
  });

// Automated checks for: validateNewCaseInwardBeforeWrite.
  describe("validateNewCaseInwardBeforeWrite", () => {
    const validParent = {
      branch: 1,
      receivedFrom: 1,
      fileMaintenance: 1,
      loanCategory: 1,
      loanType: 1,
      npaStatus: 1,
      loanAccountNo: "123456789012",
      entrustmentDate: "2026-04-10",
      npaDate: "2026-04-10",
      caseStatusUpdatedDate: "2026-04-10",
      caseStatus: 10,
      caseStatusRemarks: "ok"
    };

    test("happy path: passes for valid payload", async () => {
      const conn = createConn(
        baseRoutes({
          caseStatusLookupValue: "In Progress",
          loanAccountNoLength: 12
        })
      );

      await expect(
        validateNewCaseInwardBeforeWrite(conn, {
          parentData: validParent,
          childTableRows: { amount_recovered: [{ recoveredDate: "2026-04-10", recoveredAmount: 0 }] }
        })
      ).resolves.toBeUndefined();
    });

    test("rejects inactive lookup_value_master selection (receivedFrom)", async () => {
      const conn = createConn([
        {
          when: (sql) =>
            /SELECT\s+id\s+FROM\s+lookup_value_master/i.test(sql) &&
            sql.includes("active") &&
            sql.includes("Yes"),
          reply: [[]]
        },
        ...baseRoutes({ caseStatusLookupValue: "In Progress", loanAccountNoLength: 12 })
      ]);
      await expect(
        validateNewCaseInwardBeforeWrite(conn, {
          parentData: validParent,
          childTableRows: {}
        })
      ).rejects.toThrow("Received From: selected lookup value must be active");
    });

    test("rejects inactive branch_master selection", async () => {
      const conn = createConn([
        {
          when: (sql) =>
            /SELECT\s+id\s+FROM\s+branch_master/i.test(sql) && sql.includes("active") && sql.includes("Yes"),
          reply: [[]]
        },
        ...baseRoutes({ caseStatusLookupValue: "In Progress", loanAccountNoLength: 12 })
      ]);
      await expect(
        validateNewCaseInwardBeforeWrite(conn, {
          parentData: validParent,
          childTableRows: {}
        })
      ).rejects.toThrow("Branch: selected branch must be active");
    });

    test("rejects non-numeric loan account number", async () => {
      const conn = createConn(baseRoutes());
      await expect(
        validateNewCaseInwardBeforeWrite(conn, {
          parentData: { ...validParent, loanAccountNo: "1234A67890" },
          childTableRows: {}
        })
      ).rejects.toMatchObject({ code: "NCI_VALIDATION_FAILED" });
    });

    test("rejects loan account number length mismatch for bank rule", async () => {
      const conn = createConn(
        baseRoutes({
          caseStatusLookupValue: "Open",
          loanAccountNoLength: 10
        })
      );
      await expect(
        validateNewCaseInwardBeforeWrite(conn, {
          parentData: { ...validParent, loanAccountNo: "123456789012" },
          childTableRows: {}
        })
      ).rejects.toThrow("Loan Account No must be exactly 10 characters for Test Bank.");
    });

    test("blocks duplicate active loan account", async () => {
      const conn = createConn(
        baseRoutes({
          duplicateRows: [{ id: 77, caseNo: "ABC/CF/00007", caseStatusLabel: "In Progress" }]
        })
      );
      await expect(
        validateNewCaseInwardBeforeWrite(conn, {
          parentData: validParent,
          childTableRows: {}
        })
      ).rejects.toThrow("This case is already available");
    });

    test("blocks duplicate re-entry when existing duplicate is Returned", async () => {
      const conn = createConn(
        baseRoutes({
          duplicateRows: [{ id: 88, caseNo: "ABC/CF/00008", caseStatusLabel: "Returned" }],
          caseStatusLookupValue: "In Progress"
        })
      );
      await expect(
        validateNewCaseInwardBeforeWrite(conn, {
          parentData: validParent,
          childTableRows: {}
        })
      ).rejects.toThrow("This case is already available");
    });

    test("allows duplicate re-entry when existing duplicate is Closed", async () => {
      const conn = createConn(
        baseRoutes({
          duplicateRows: [{ id: 89, caseNo: "ABC/CF/00009", caseStatusLabel: "Closed" }],
          caseStatusLookupValue: "In Progress"
        })
      );
      await expect(
        validateNewCaseInwardBeforeWrite(conn, {
          parentData: validParent,
          childTableRows: {}
        })
      ).resolves.toBeUndefined();
    });

    test("rejects future entrustment date", async () => {
      const conn = createConn(baseRoutes());
      await expect(
        validateNewCaseInwardBeforeWrite(conn, {
          parentData: { ...validParent, entrustmentDate: "2026-04-11" },
          childTableRows: {}
        })
      ).rejects.toThrow("Entrustment Date cannot be greater than today.");
    });

    test("parses DD-MM-YYYY and still rejects future entrustment date", async () => {
      const conn = createConn(baseRoutes());
      await expect(
        validateNewCaseInwardBeforeWrite(conn, {
          parentData: { ...validParent, entrustmentDate: "11-04-2026" },
          childTableRows: {}
        })
      ).rejects.toThrow("Entrustment Date cannot be greater than today.");
    });

    test("rejects future npa date", async () => {
      const conn = createConn(baseRoutes());
      await expect(
        validateNewCaseInwardBeforeWrite(conn, {
          parentData: { ...validParent, npaDate: "2026-04-11" },
          childTableRows: {}
        })
      ).rejects.toThrow("NPA Date cannot be greater than today.");
    });

    test("rejects future case status updated date", async () => {
      const conn = createConn(baseRoutes());
      await expect(
        validateNewCaseInwardBeforeWrite(conn, {
          parentData: { ...validParent, caseStatusUpdatedDate: "2026-04-11" },
          childTableRows: {}
        })
      ).rejects.toThrow("Case Status Updated Date cannot be greater than today.");
    });

    test("blocks non-admin when FY is frozen for case status updated date", async () => {
      const conn = createConn(
        baseRoutes({
          fyRows: [{ freezeTransactions: "Yes" }],
          caseStatusLookupValue: "In Progress"
        })
      );
      await expect(
        validateNewCaseInwardBeforeWrite(conn, {
          parentData: validParent,
          childTableRows: {}
        })
      ).rejects.toThrow("Transactions are locked for the selected financial year. Please contact the administrator.");
    });

    test("allows when no financial year matches case status updated date", async () => {
      const conn = createConn(
        baseRoutes({
          fyRows: [],
          caseStatusLookupValue: "In Progress"
        })
      );
      await expect(
        validateNewCaseInwardBeforeWrite(conn, {
          parentData: validParent,
          childTableRows: {}
        })
      ).resolves.toBeUndefined();
    });

    test("blocks non-admin in edit mode even when caseStatusUpdatedDate is omitted in payload", async () => {
      const conn = createConn(
        baseRoutes({
          fyRows: [{ freezeTransactions: "Yes" }],
          snapshotParentRows: [{ entrustmentDate: "2026-03-30", caseStatusUpdatedDate: "2026-03-31" }],
          caseStatusLookupValue: "In Progress"
        })
      );
      const { caseStatusUpdatedDate, ...parentWithoutCaseStatusDate } = validParent;
      await expect(
        validateNewCaseInwardBeforeWrite(conn, {
          parentData: parentWithoutCaseStatusDate,
          childTableRows: {},
          parentId: 101
        })
      ).rejects.toThrow("Transactions are locked for the selected financial year. Please contact the administrator.");
    });

    test("enforces transaction-control backdate on entrustment date", async () => {
      const conn = createConn(
        baseRoutes({
          txnRows: [{ field_name: "Entrustment Date", allow_flag: "No", days: 2, is_active: 1 }]
        })
      );

      await expect(
        validateNewCaseInwardBeforeWrite(conn, {
          parentData: { ...validParent, entrustmentDate: "2026-04-07" }, // older than min 2026-04-08
          childTableRows: {}
        })
      ).rejects.toThrow("Entrustment Date cannot be older than 2 days as per Transaction Control.");
    });

    test("enforces transaction-control backdate on recovered date", async () => {
      const conn = createConn(
        baseRoutes({
          txnRows: [{ field_name: "Amount Recovered", allow_flag: "No", days: 1, is_active: 1 }],
          caseStatusLookupValue: "In Progress"
        })
      );

      await expect(
        validateNewCaseInwardBeforeWrite(conn, {
          parentData: validParent,
          childTableRows: { amount_recovered: [{ recoveredDate: "2026-04-08", recoveredAmount: 100 }] }
        })
      ).rejects.toThrow("Amount Recovered Date cannot be older than 1 days as per Transaction Control.");
    });

    test("enforces transaction-control backdate on case status updated date", async () => {
      const conn = createConn(
        baseRoutes({
          txnRows: [{ field_name: "Case Status Update", allow_flag: "No", days: 1, is_active: 1 }],
          snapshotParentRows: [{ entrustmentDate: "2026-04-10", caseStatusUpdatedDate: "2026-04-10" }],
          caseStatusLookupValue: "In Progress"
        })
      );

      await expect(
        validateNewCaseInwardBeforeWrite(conn, {
          parentData: { ...validParent, caseStatusUpdatedDate: "2026-04-08" },
          childTableRows: {},
          parentId: 101
        })
      ).rejects.toThrow("Case Status Updated Date cannot be older than 1 days as per Transaction Control.");
    });

    test("edit mode requires case-status updated date when case status is selected", async () => {
      const conn = createConn(baseRoutes({ caseStatusLookupValue: "In Progress" }));
      await expect(
        validateNewCaseInwardBeforeWrite(conn, {
          parentData: { ...validParent, caseStatus: 10, caseStatusUpdatedDate: "   " },
          childTableRows: {},
          parentId: 101
        })
      ).rejects.toThrow("Case Status Updated Date is required when Case Status is selected.");
    });

    test("edit mode requires case-status remarks when case status is selected", async () => {
      const conn = createConn(baseRoutes({ caseStatusLookupValue: "In Progress" }));
      await expect(
        validateNewCaseInwardBeforeWrite(conn, {
          parentData: { ...validParent, caseStatus: 10, caseStatusRemarks: "   " },
          childTableRows: {},
          parentId: 101
        })
      ).rejects.toThrow("Case Status Remarks is required when Case Status is selected.");
    });

    test("edit mode allows save when case status is blank and unrelated field is edited", async () => {
      const conn = createConn(baseRoutes({ caseStatusLookupValue: "In Progress", loanAccountNoLength: 12 }));
      await expect(
        validateNewCaseInwardBeforeWrite(conn, {
          parentData: {
            ...validParent,
            loanAccountNo: "123456789012",
            caseStatus: "",
            caseStatusUpdatedDate: "",
            caseStatusRemarks: ""
          },
          childTableRows: {},
          parentId: 101
        })
      ).resolves.toBeUndefined();
    });

    test("requires recovered amount for configured status (child rows payload)", async () => {
      const conn = createConn(baseRoutes({ caseStatusLookupValue: "Closed", loanAccountNoLength: 12 }));
      await expect(
        validateNewCaseInwardBeforeWrite(conn, {
          parentData: validParent,
          childTableRows: { amount_recovered: [{ recoveredDate: "2026-04-10", recoveredAmount: 0 }] }
        })
      ).rejects.toThrow("Selected Case Status requires Amount Recovered to be at least");
    });

    test("uses DB sum fallback for recovery requirement when child rows omitted", async () => {
      const conn = createConn(
        baseRoutes({
          caseStatusLookupValue: "Auctioned",
          sumRecovered: 0
        })
      );
      await expect(
        validateNewCaseInwardBeforeWrite(conn, {
          parentData: validParent,
          childTableRows: undefined,
          parentId: 999
        })
      ).rejects.toThrow("Selected Case Status requires Amount Recovered to be at least");
    });

    test("passes recovery requirement when positive recovered amount exists", async () => {
      const conn = createConn(baseRoutes({ caseStatusLookupValue: "Part Recovery", loanAccountNoLength: 12 }));
      await expect(
        validateNewCaseInwardBeforeWrite(conn, {
          parentData: validParent,
          childTableRows: { amount_recovered: [{ recoveredDate: "2026-04-10", recoveredAmount: 1 }] }
        })
      ).resolves.toBeUndefined();
    });

    test("edge: update path skips unchanged controlled dates", async () => {
      const conn = createConn(
        baseRoutes({
          txnRows: [
            { field_name: "Entrustment Date", allow_flag: "No", days: 0, is_active: 1 },
            { field_name: "Amount Recovered", allow_flag: "No", days: 0, is_active: 1 },
            { field_name: "Case Status Update", allow_flag: "No", days: 0, is_active: 1 }
          ],
          snapshotParentRows: [{ entrustmentDate: "2026-04-07", caseStatusUpdatedDate: "2026-04-07" }],
          snapshotChildRows: [{ id: 5001, recoveredDate: "2026-04-07" }],
          caseStatusLookupValue: "In Progress"
        })
      );

      await expect(
        validateNewCaseInwardBeforeWrite(conn, {
          parentData: {
            ...validParent,
            entrustmentDate: "2026-04-07",
            caseStatusUpdatedDate: "2026-04-07"
          },
          childTableRows: { amount_recovered: [{ id: 5001, recoveredDate: "2026-04-07", recoveredAmount: 200 }] },
          parentId: 101
        })
      ).resolves.toBeUndefined();
    });

    test("admin override skips backdate/freeze restrictions but still allows valid non-future dates", async () => {
      const conn = createConn(
        baseRoutes({
          fyRows: [{ freezeTransactions: "Yes" }],
          txnRows: [
            { field_name: "Entrustment Date", allow_flag: "No", days: 0, is_active: 1 },
            { field_name: "Amount Recovered", allow_flag: "No", days: 0, is_active: 1 },
            { field_name: "Case Status Update", allow_flag: "No", days: 0, is_active: 1 }
          ],
          caseStatusLookupValue: "In Progress"
        })
      );

      await expect(
        validateNewCaseInwardBeforeWrite(conn, {
          parentData: {
            ...validParent,
            entrustmentDate: "2026-04-10",
            caseStatusUpdatedDate: "2026-04-10"
          },
          childTableRows: { amount_recovered: [{ recoveredDate: "2026-04-01", recoveredAmount: 100 }] },
          skipDateValidationsForAdmin: true
        })
      ).resolves.toBeUndefined();
    });

    test("admin still cannot use future entrustment date", async () => {
      const conn = createConn(baseRoutes({ caseStatusLookupValue: "In Progress" }));
      await expect(
        validateNewCaseInwardBeforeWrite(conn, {
          parentData: { ...validParent, entrustmentDate: "2026-04-11" },
          childTableRows: {},
          skipDateValidationsForAdmin: true
        })
      ).rejects.toThrow("Entrustment Date cannot be greater than today.");
    });

    test("rejects future amount recovered date for all roles", async () => {
      const conn = createConn(baseRoutes({ caseStatusLookupValue: "In Progress" }));
      await expect(
        validateNewCaseInwardBeforeWrite(conn, {
          parentData: validParent,
          childTableRows: { amount_recovered: [{ recoveredDate: "2026-04-11", recoveredAmount: 10 }] },
          skipDateValidationsForAdmin: true
        })
      ).rejects.toThrow("Amount Recovered Date cannot be greater than today.");
    });

    test("continues validation when transaction-control table query fails", async () => {
      const routes = [
        {
          when: (sql) => sql.includes("SELECT field_name, allow_flag, days, is_active FROM new_case_inward_transaction_control"),
          reply: () => {
            throw new Error("table missing");
          }
        },
        ...baseRoutes({
          caseStatusLookupValue: "In Progress",
          loanAccountNoLength: 12
        }).filter((r) => !r.when("SELECT field_name, allow_flag, days, is_active FROM new_case_inward_transaction_control", []))
      ];
      const conn = createConn(routes);

      await expect(
        validateNewCaseInwardBeforeWrite(conn, {
          parentData: { ...validParent, entrustmentDate: "2026-01-01" },
          childTableRows: {}
        })
      ).resolves.toBeUndefined();
    });
  });

// Automated checks for: assignNewCaseInwardCaseNo.
  describe("assignNewCaseInwardCaseNo", () => {
    const chainQueryMatch = (sql) =>
      sql.includes("loanCategoryLabel") && sql.includes("caseNoPrefix");
    const sequenceNormalizeLockMatch = (sql) =>
      sql.includes("module_number_sequence") && sql.includes("CHAR(13)") && sql.includes("FOR UPDATE");

    test("assigns next case number with mapped loan category code", async () => {
      const conn = createConn([
        {
          when: (sql) => chainQueryMatch(sql),
          reply: [[{ loanCategoryLabel: "Collateral Free", caseNoPrefix: "SBI" }]]
        },
        {
          when: (sql) => sequenceNormalizeLockMatch(sql),
          reply: [[{ module: "new_case_inward", prefix: "SBI/CF", lastNumber: 9 }]]
        },
        {
          when: (sql) => sql.includes("UPDATE module_number_sequence SET lastNumber = ?"),
          reply: [{ affectedRows: 1 }]
        },
        {
          when: (sql) => sql.includes("UPDATE new_case_inward SET caseNo = ? WHERE id = ?"),
          reply: [{ affectedRows: 1 }]
        }
      ]);

      await expect(assignNewCaseInwardCaseNo(conn, 101)).resolves.toBeUndefined();

      const finalUpdate = conn.query.mock.calls.find(([sql]) =>
        sql.includes("UPDATE new_case_inward SET caseNo = ? WHERE id = ?")
      );
      expect(finalUpdate).toBeTruthy();
      expect(finalUpdate[1][0]).toBe("SBI/CF/00010");
      expect(finalUpdate[1][1]).toBe(101);
    });

    test("resolves sequence row when stored keys have trailing CRLF", async () => {
      const conn = createConn([
        {
          when: (sql) => chainQueryMatch(sql),
          reply: [[{ loanCategoryLabel: "Agricultural Loan", caseNoPrefix: "S" }]]
        },
        {
          when: (sql) => sequenceNormalizeLockMatch(sql),
          reply: [[{ module: "new_case_inward\r\n", prefix: "S/AL\r\n", lastNumber: 14742 }]]
        },
        {
          when: (sql) => sql.includes("UPDATE module_number_sequence SET lastNumber = ?"),
          reply: [{ affectedRows: 1 }]
        },
        {
          when: (sql) => sql.includes("UPDATE new_case_inward SET caseNo = ? WHERE id = ?"),
          reply: [{ affectedRows: 1 }]
        }
      ]);

      await expect(assignNewCaseInwardCaseNo(conn, 202)).resolves.toBeUndefined();

      const seqUpdate = conn.query.mock.calls.find(([sql]) =>
        sql.includes("UPDATE module_number_sequence SET lastNumber = ?")
      );
      expect(seqUpdate[1][0]).toBe(14743);
      expect(seqUpdate[1][1]).toBe("new_case_inward\r\n");
      expect(seqUpdate[1][2]).toBe("S/AL\r\n");

      const finalUpdate = conn.query.mock.calls.find(([sql]) =>
        sql.includes("UPDATE new_case_inward SET caseNo = ? WHERE id = ?")
      );
      expect(finalUpdate[1][0]).toBe("S/AL/14743");
    });

    test("fails when loan category is missing on inserted row", async () => {
      const conn = createConn([
        {
          when: (sql) => chainQueryMatch(sql),
          reply: [[]]
        },
        {
          when: (sql) => sql.includes("SELECT loanCategory FROM new_case_inward WHERE id = ? LIMIT 1"),
          reply: [[{ loanCategory: null }]]
        }
      ]);
      await expect(assignNewCaseInwardCaseNo(conn, 5)).rejects.toMatchObject({ code: "LOAN_CATEGORY_MISSING" });
    });

    test("fails when loan category label is not mapped", async () => {
      const conn = createConn([
        {
          when: (sql) => chainQueryMatch(sql),
          reply: [[{ loanCategoryLabel: "Unknown Type", caseNoPrefix: "SBI" }]]
        }
      ]);
      await expect(assignNewCaseInwardCaseNo(conn, 5)).rejects.toMatchObject({
        code: "LOAN_CATEGORY_CASE_NO_UNKNOWN"
      });
    });

    test("fails when loan category FK is set but cannot be resolved", async () => {
      const conn = createConn([
        {
          when: (sql) => chainQueryMatch(sql),
          reply: [[]]
        },
        {
          when: (sql) => sql.includes("SELECT loanCategory FROM new_case_inward WHERE id = ? LIMIT 1"),
          reply: [[{ loanCategory: "abc" }]]
        }
      ]);
      await expect(assignNewCaseInwardCaseNo(conn, 5)).rejects.toMatchObject({ code: "CASE_NO_PREFIX_UNRESOLVED" });
    });

    test("fails when bank prefix chain cannot be resolved", async () => {
      const conn = createConn([
        {
          when: (sql) => chainQueryMatch(sql),
          reply: [[]]
        },
        {
          when: (sql) => sql.includes("SELECT loanCategory FROM new_case_inward WHERE id = ? LIMIT 1"),
          reply: [[{ loanCategory: 4 }]]
        }
      ]);
      await expect(assignNewCaseInwardCaseNo(conn, 5)).rejects.toMatchObject({ code: "CASE_NO_PREFIX_UNRESOLVED" });
    });

    test("fails when bank prefix is blank", async () => {
      const conn = createConn([
        {
          when: (sql) => chainQueryMatch(sql),
          reply: [[{ loanCategoryLabel: "SARFAESI", caseNoPrefix: "   " }]]
        }
      ]);
      await expect(assignNewCaseInwardCaseNo(conn, 5)).rejects.toMatchObject({ code: "CASE_NO_PREFIX_EMPTY" });
    });

    test("fails when sequence row is missing after upsert", async () => {
      const conn = createConn([
        {
          when: (sql) => chainQueryMatch(sql),
          reply: [[{ loanCategoryLabel: "Vehicle Loan", caseNoPrefix: "CAN" }]]
        },
        {
          when: (sql) => sequenceNormalizeLockMatch(sql),
          reply: [[]]
        },
        {
          when: (sql) => sql.includes("INSERT INTO module_number_sequence"),
          reply: [{ affectedRows: 1 }]
        }
      ]);
      await expect(assignNewCaseInwardCaseNo(conn, 5)).rejects.toMatchObject({ code: "CASE_NO_SEQUENCE_ROW" });
    });
  });

  describe("case number helpers", () => {
    test("normalizeCaseNoBankPrefix trims and removes trailing slashes", () => {
      expect(normalizeCaseNoBankPrefix(" S/ ")).toBe("S");
      expect(buildCaseNoSequencePrefix("S/", "AL")).toBe("S/AL");
    });
  });
});


