/**
 * Tests for lib/modules/reminderDashboard.service.js
 */

jest.mock("mysql2", () => ({
  escapeId: jest.fn((v) => `\`${String(v)}\``)
}));

jest.mock("../../config/modules", () => ({
  modules: {
    reminder_master: {
      table: "reminder_master",
      fields: [
        { name: "reminderTitle", type: "text", required: true },
        { name: "notes", type: "text" },
        { name: "dueDate", type: "date" },
        { name: "recurrenceType", type: "select" },
        { name: "status", type: "select" },
        { name: "id" },
        { name: "createdBy" }
      ],
      childTables: [{ key: "activity_log", table: "reminder_activity_log", syncMode: "serverOnly" }]
    },
    users: { table: "users" }
  }
}));

const mockConnQuery = jest.fn();
const mockConn = {
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  release: jest.fn(),
  query: mockConnQuery
};

jest.mock("../../lib/db", () => {
  const query = jest.fn();
  const getConnection = jest.fn();
  return {
    __esModule: true,
    default: { query, getConnection },
    queryWithRetry: (sql, values) => query(sql, values)
  };
});

jest.mock("../../lib/sqlModuleTable", () => ({
  escapeSqlTableIdForModuleConfig: jest.fn(() => "`reminder_master`")
}));

jest.mock("../../lib/childTablesLoad", () => ({
  loadChildTableRowsForParent: jest.fn().mockResolvedValue({ activity_log: [] })
}));

jest.mock("../../lib/services/crudPayloadValidation", () => ({
  validateCrudPayloadForWrite: jest.fn(() => null)
}));

jest.mock("../../lib/crudRecordAudit", () => ({
  applyCreateAudit: jest.fn((row, uid) => ({ ...row, createdBy: uid, createdDate: "2026-06-13 12:00:00" })),
  applyUpdateAudit: jest.fn((row, uid) => ({ ...row, modifiedBy: uid, modifiedDate: "2026-06-13 12:00:00" })),
  stripClientAuditFields: jest.fn((row) => row)
}));

jest.mock("../../lib/crudNormalize", () => ({
  normalizeCrudPayload: jest.fn((row) => row)
}));

jest.mock("../../lib/modules/reminder", () => ({
  REMINDER_STATUSES: ["Pending", "Completed", "Cancelled"],
  applyReminderBeforeWrite: jest.fn().mockResolvedValue(undefined),
  applyReminderAfterCreateWrite: jest.fn().mockResolvedValue(undefined),
  applyReminderAfterUpdateWrite: jest.fn().mockResolvedValue(undefined),
  spawnNextOccurrence: jest.fn().mockResolvedValue(null),
  insertActivityLogRow: jest.fn().mockResolvedValue(undefined)
}));

jest.mock("../../lib/istDateTime", () => ({
  formatInstantAsMysqlDatetimeIST: jest.fn(() => "2026-06-13 12:00:00"),
  getYmdISTFromInstant: jest.fn(() => "2026-06-13")
}));

const pool = require("../../lib/db").default;
const {
  userCanViewReminder,
  userCanEditReminder,
  reminderPermissionsForUser,
  appendReminderOwnerFilter,
  buildDueCalendarGrid,
  loadReminderDashboardSummary,
  loadReminderAlerts,
  listRemindersForDashboard
} = require("../../lib/modules/reminderDashboard.service");

function buildOwnerSql(user) {
  const whereParts = [];
  const whereValues = [];
  appendReminderOwnerFilter(user, whereParts, whereValues);
  return { whereParts, whereValues };
}

describe("reminderDashboard.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pool.getConnection.mockResolvedValue(mockConn);
    mockConnQuery.mockResolvedValue([[]]);
    pool.query.mockResolvedValue([[{ status: "Pending", cnt: 2 }]]);
  });

  describe("appendReminderOwnerFilter", () => {
    test("regular user filters by createdBy", () => {
      const { whereParts, whereValues } = buildOwnerSql({ id: 7, role: 2 });
      expect(whereParts.join(" ")).toContain("`createdBy` = ?");
      expect(whereValues).toEqual([7]);
    });

    test("admin has no owner filter", () => {
      const { whereParts, whereValues } = buildOwnerSql({ id: 1, role: 1 });
      expect(whereParts).toEqual([]);
      expect(whereValues).toEqual([]);
    });
  });

  describe("userCanViewReminder / userCanEditReminder", () => {
    test("owner can view and edit", () => {
      const row = { createdBy: 5 };
      expect(userCanViewReminder({ id: 5, role: 2 }, row)).toBe(true);
      expect(userCanEditReminder({ id: 5, role: 2 }, row)).toBe(true);
    });

    test("non-owner cannot view or edit", () => {
      const row = { createdBy: 5 };
      expect(userCanViewReminder({ id: 9, role: 2 }, row)).toBe(false);
      expect(userCanEditReminder({ id: 9, role: 2 }, row)).toBe(false);
    });

    test("admin can view and edit any reminder", () => {
      const row = { createdBy: 5 };
      expect(userCanViewReminder({ id: 1, role: 1 }, row)).toBe(true);
      expect(userCanEditReminder({ id: 1, role: 1 }, row)).toBe(true);
    });
  });

  describe("reminderPermissionsForUser", () => {
    test("owner gets full permissions", () => {
      const perms = reminderPermissionsForUser({ id: 5, role: 2 }, { createdBy: 5 });
      expect(perms).toEqual(
        expect.objectContaining({
          canEditDetails: true,
          canUpdateStatus: true,
          isOwner: true,
          isAdmin: false
        })
      );
    });

    test("admin flagged as isAdmin", () => {
      const perms = reminderPermissionsForUser({ id: 1, role: 1 }, { createdBy: 5 });
      expect(perms.isAdmin).toBe(true);
      expect(perms.canEditDetails).toBe(true);
    });

    test("completed reminder locked for owner", () => {
      const perms = reminderPermissionsForUser(
        { id: 5, role: 2 },
        { createdBy: 5, status: "Completed" }
      );
      expect(perms).toEqual(
        expect.objectContaining({
          canEditDetails: false,
          canUpdateStatus: false,
          isOwner: true,
          isCompletedLocked: true
        })
      );
    });

    test("completed reminder editable for admin", () => {
      const perms = reminderPermissionsForUser(
        { id: 1, role: 1 },
        { createdBy: 5, status: "Completed" }
      );
      expect(perms).toEqual(
        expect.objectContaining({
          canEditDetails: true,
          canUpdateStatus: true,
          isAdmin: true,
          isCompletedLocked: false
        })
      );
    });
  });

  describe("buildDueCalendarGrid", () => {
    test("builds month grid with today marker", () => {
      const grid = buildDueCalendarGrid("2026-06-13", { "2026-06-13": 2 });
      expect(grid.today).toBe("2026-06-13");
      expect(grid.cells.some((c) => c.isToday && c.count === 2)).toBe(true);
    });
  });

  describe("loadReminderDashboardSummary", () => {
    test("returns summary shape", async () => {
      pool.query
        .mockResolvedValueOnce([[{ status: "Pending", cnt: 1 }]])
        .mockResolvedValueOnce([
          [
            {
              totalReminders: 1,
              completedReminders: 0,
              pendingReminders: 1,
              cancelledReminders: 0,
              overdueReminders: 0,
              dueToday: 0,
              dueThisWeek: 0
            }
          ]
        ])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[{ cnt: 0 }]]);

      const summary = await loadReminderDashboardSummary({ id: 5, role: 2 });
      expect(summary).toEqual(
        expect.objectContaining({
          openCount: 1,
          metrics: expect.objectContaining({ totalReminders: 1 }),
          calendar: expect.objectContaining({ cells: expect.any(Array) })
        })
      );
    });
  });

  describe("listRemindersForDashboard", () => {
    test("omits status filter when status not provided (All)", async () => {
      pool.query.mockResolvedValueOnce([[]]);

      await listRemindersForDashboard({ id: 7, role: 2 }, {});

      const [sql] = pool.query.mock.calls[0];
      expect(sql).not.toContain("`status` = 'Pending'");
      expect(sql).not.toMatch(/`status`\s*=\s*\?/);
    });

    test("filters by status when provided", async () => {
      pool.query.mockResolvedValueOnce([[]]);

      await listRemindersForDashboard({ id: 7, role: 2 }, { status: "Completed" });

      const [sql, values] = pool.query.mock.calls[0];
      expect(sql).toContain("`status` = ?");
      expect(values).toContain("Completed");
    });

    test("filters by dueDate when provided", async () => {
      pool.query.mockResolvedValueOnce([[]]);

      await listRemindersForDashboard({ id: 7, role: 2 }, { dueDate: "2026-06-14" });

      const [sql, values] = pool.query.mock.calls[0];
      expect(sql).toContain("DATE(`dueDate`) = ?");
      expect(values).toContain("2026-06-14");
    });
  });

  describe("loadReminderAlerts", () => {
    test("returns counts and pending due/overdue items for owner", async () => {
      pool.query
        .mockResolvedValueOnce([
          [
            {
              totalReminders: 3,
              completedReminders: 0,
              pendingReminders: 3,
              cancelledReminders: 0,
              overdueReminders: 2,
              dueToday: 1,
              dueThisWeek: 0
            }
          ]
        ])
        .mockResolvedValueOnce([
          [
            { id: 1, reminderTitle: "Overdue", dueDate: "2026-06-01", status: "Pending" },
            { id: 2, reminderTitle: "Today", dueDate: "2026-06-13", status: "Pending" }
          ]
        ]);

      const alerts = await loadReminderAlerts({ id: 7, role: 2 });

      expect(alerts).toEqual({
        overdueCount: 2,
        dueTodayCount: 1,
        alertCount: 3,
        items: [
          expect.objectContaining({ id: 1, reminderTitle: "Overdue", isOverdue: true }),
          expect.objectContaining({ id: 2, reminderTitle: "Today", isOverdue: false })
        ]
      });

      const [itemsSql, itemsValues] = pool.query.mock.calls[1];
      expect(itemsSql).toContain("`status` = ?");
      expect(itemsSql).toContain("DATE(`dueDate`) <= CURDATE()");
      expect(itemsValues).toContain("Pending");
      expect(itemsValues).toContain(7);
      expect(itemsValues).toContain(10);
    });

    test("admin query omits owner filter", async () => {
      pool.query
        .mockResolvedValueOnce([
          [
            {
              totalReminders: 1,
              completedReminders: 0,
              pendingReminders: 1,
              cancelledReminders: 0,
              overdueReminders: 1,
              dueToday: 0,
              dueThisWeek: 0
            }
          ]
        ])
        .mockResolvedValueOnce([[{ id: 9, reminderTitle: "Any", dueDate: "2026-06-01", status: "Pending" }]]);

      await loadReminderAlerts({ id: 1, role: 1 });

      const [itemsSql, itemsValues] = pool.query.mock.calls[1];
      expect(itemsSql).not.toContain("`createdBy` = ?");
      expect(itemsValues).not.toContain(1);
    });
  });
});
