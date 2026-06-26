/**
 * Tests for lib/modules/taskDashboard.service.js
 */

jest.mock("mysql2", () => ({
  escapeId: jest.fn((v) => `\`${String(v)}\``)
}));

jest.mock("../../config/modules", () => ({
  modules: {
    task_master: {
      table: "task_master",
      fields: [
        { name: "taskTitle", type: "text", required: true },
        { name: "description", type: "text" },
        { name: "dueDate", type: "date" },
        { name: "priority", type: "select" },
        { name: "assignee", type: "lookup", required: true, lookup: { module: "users" } },
        { name: "followUpPerson", type: "lookup", lookup: { module: "users" } },
        { name: "status", type: "select" },
        { name: "id" },
        { name: "createdBy" }
      ]
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
  escapeSqlTableIdForModuleConfig: jest.fn(() => "`task_master`")
}));

jest.mock("../../lib/childTablesLoad", () => ({
  loadChildTableRowsForParent: jest.fn().mockResolvedValue({ activity_log: [], comments: [] })
}));

jest.mock("../../lib/services/crudPayloadValidation", () => ({
  validateCrudPayloadForWrite: jest.fn(() => null)
}));

jest.mock("../../lib/crudRecordAudit", () => ({
  applyCreateAudit: jest.fn((row, uid) => ({ ...row, createdBy: uid, createdDate: "2026-06-13 12:00:00" })),
  applyUpdateAudit: jest.fn((row, uid) => ({ ...row, modifiedBy: uid, modifiedDate: "2026-06-13 12:00:00" })),
  stripClientAuditFields: jest.fn((row) => row)
}));

jest.mock("../../lib/modules/task", () => ({
  applyTaskBeforeWrite: jest.fn().mockResolvedValue(undefined),
  applyTaskAfterCreateWrite: jest.fn().mockResolvedValue(undefined),
  applyTaskAfterUpdateWrite: jest.fn().mockResolvedValue(undefined),
  enrichNewCommentRows: jest.fn()
}));

jest.mock("../../lib/istDateTime", () => ({
  formatInstantAsMysqlDatetimeIST: jest.fn(() => "2026-06-13 12:00:00"),
  getYmdISTFromInstant: jest.fn(() => "2026-06-13")
}));

const pool = require("../../lib/db").default;
const { validateCrudPayloadForWrite } = require("../../lib/services/crudPayloadValidation");
const {
  userCanViewTask,
  userCanEditTaskDetails,
  userCanUpdateTaskStatus,
  userCanCommentOnTask,
  taskPermissionsForUser,
  normalizeBucket,
  appendBucketFilter,
  appendTaskAlertsScope,
  loadTaskAlerts,
  loadTaskDashboardSummary,
  listTasksForDashboard,
  getStatusCountsForBucket,
  createTaskFromDashboard,
  updateTaskFromDashboard,
  buildDueCalendarGrid
} = require("../../lib/modules/taskDashboard.service");

function buildBucketSql(user, bucket) {
  const whereParts = [];
  const whereValues = [];
  appendBucketFilter(bucket, user, whereParts, whereValues);
  return { whereParts, whereValues };
}

function rowMatchesBucket(row, user, bucket) {
  const uid = Number(user.id);
  if (bucket === "assigned_to_me") {
    return Number(row.assignee) === uid || Number(row.followUpPerson) === uid;
  }
  return Number(row.createdBy) === uid && Number(row.assignee) !== uid;
}

describe("taskDashboard.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pool.getConnection.mockResolvedValue(mockConn);
    mockConnQuery.mockResolvedValue([{ affectedRows: 1 }]);
  });

  describe("normalizeBucket", () => {
    test("defaults to assigned_to_me", () => {
      expect(normalizeBucket()).toBe("assigned_to_me");
      expect(normalizeBucket("")).toBe("assigned_to_me");
    });

    test("accepts assigned_by_me", () => {
      expect(normalizeBucket("assigned_by_me")).toBe("assigned_by_me");
    });
  });

  describe("appendBucketFilter", () => {
    test("assigned_to_me filters by assignee or followUpPerson for regular user", () => {
      const { whereParts, whereValues } = buildBucketSql({ id: 7, role: 2 }, "assigned_to_me");
      expect(whereParts.join(" ")).toContain("`assignee` = ? OR `followUpPerson` = ?");
      expect(whereValues).toEqual([7, 7]);
    });

    test("assigned_by_me filters by createdBy and excludes self-assignee", () => {
      const { whereParts, whereValues } = buildBucketSql({ id: 7, role: 2 }, "assigned_by_me");
      expect(whereParts.join(" ")).toContain("`createdBy` = ? AND `assignee` <> ?");
      expect(whereValues).toEqual([7, 7]);
    });

    test("admin assigned_to_me uses same user-scoped assignee/followUp filter", () => {
      const { whereParts, whereValues } = buildBucketSql({ id: 1, role: 1 }, "assigned_to_me");
      expect(whereParts.join(" ")).toContain("`assignee` = ? OR `followUpPerson` = ?");
      expect(whereValues).toEqual([1, 1]);
    });

    test("admin assigned_by_me uses same user-scoped createdBy filter", () => {
      const { whereParts, whereValues } = buildBucketSql({ id: 1, role: 1 }, "assigned_by_me");
      expect(whereParts.join(" ")).toContain("`createdBy` = ? AND `assignee` <> ?");
      expect(whereValues).toEqual([1, 1]);
    });

    test("buckets are mutually exclusive for the same user", () => {
      const user = { id: 7, role: 2 };
      const rows = [
        { assignee: 7, createdBy: 10, followUpPerson: null },
        { assignee: 5, createdBy: 7, followUpPerson: null },
        { assignee: 5, createdBy: 10, followUpPerson: 7 },
        { assignee: 7, createdBy: 7, followUpPerson: null }
      ];
      for (const row of rows) {
        const inMy = rowMatchesBucket(row, user, "assigned_to_me");
        const inAssigned = rowMatchesBucket(row, user, "assigned_by_me");
        expect(inMy && inAssigned).toBe(false);
      }
      expect(rowMatchesBucket(rows[0], user, "assigned_to_me")).toBe(true);
      expect(rowMatchesBucket(rows[1], user, "assigned_by_me")).toBe(true);
      expect(rowMatchesBucket(rows[2], user, "assigned_to_me")).toBe(true);
      expect(rowMatchesBucket(rows[3], user, "assigned_to_me")).toBe(true);
      expect(rowMatchesBucket(rows[3], user, "assigned_by_me")).toBe(false);
    });
  });

  describe("task permissions", () => {
    const row = { assignee: 5, createdBy: 10 };

    test("assignee can view, update status, comment; not edit details", () => {
      expect(userCanViewTask({ id: 5, role: 2 }, row)).toBe(true);
      expect(userCanEditTaskDetails({ id: 5, role: 2 }, row)).toBe(false);
      expect(userCanUpdateTaskStatus({ id: 5, role: 2 }, row)).toBe(true);
      expect(userCanCommentOnTask({ id: 5, role: 2 }, row)).toBe(true);
    });

    test("creator (not assignee) can view, edit details, comment; not update status", () => {
      expect(userCanViewTask({ id: 10, role: 2 }, row)).toBe(true);
      expect(userCanEditTaskDetails({ id: 10, role: 2 }, row)).toBe(true);
      expect(userCanUpdateTaskStatus({ id: 10, role: 2 }, row)).toBe(false);
      expect(userCanCommentOnTask({ id: 10, role: 2 }, row)).toBe(true);
    });

    test("follow-up person can view and comment only", () => {
      const followRow = { assignee: 5, createdBy: 10, followUpPerson: 8 };
      expect(userCanViewTask({ id: 8, role: 2 }, followRow)).toBe(true);
      expect(userCanEditTaskDetails({ id: 8, role: 2 }, followRow)).toBe(false);
      expect(userCanUpdateTaskStatus({ id: 8, role: 2 }, followRow)).toBe(false);
      expect(userCanCommentOnTask({ id: 8, role: 2 }, followRow)).toBe(true);
      const perms = taskPermissionsForUser({ id: 8, role: 2 }, followRow);
      expect(perms.isFollowUpOnly).toBe(true);
      expect(perms.canComment).toBe(true);
      expect(perms.canEditDetails).toBe(false);
      expect(perms.canUpdateStatus).toBe(false);
    });

    test("self-assigned user gets all capabilities", () => {
      const selfRow = { assignee: 7, createdBy: 7 };
      const perms = taskPermissionsForUser({ id: 7, role: 2 }, selfRow);
      expect(perms.canEditDetails).toBe(true);
      expect(perms.canUpdateStatus).toBe(true);
      expect(perms.canComment).toBe(true);
    });

    test("unrelated user denied", () => {
      expect(userCanViewTask({ id: 99, role: 2 }, row)).toBe(false);
      expect(userCanEditTaskDetails({ id: 99, role: 2 }, row)).toBe(false);
      expect(userCanUpdateTaskStatus({ id: 99, role: 2 }, row)).toBe(false);
      expect(userCanCommentOnTask({ id: 99, role: 2 }, row)).toBe(false);
    });

    test("admin has all permissions", () => {
      const perms = taskPermissionsForUser({ id: 1, role: 1 }, row);
      expect(perms.canEditDetails).toBe(true);
      expect(perms.canUpdateStatus).toBe(true);
      expect(perms.canComment).toBe(true);
    });
  });

  describe("listTasksForDashboard bucket filters", () => {
    test("assigned_to_me filters by assignee or followUpPerson for regular user", async () => {
      pool.query.mockResolvedValueOnce([[]]);
      await listTasksForDashboard({ id: 7, role: 2 }, { bucket: "assigned_to_me" });
      expect(String(pool.query.mock.calls[0][0])).toContain("`assignee` = ? OR `followUpPerson` = ?");
      expect(pool.query.mock.calls[0][1]).toEqual([7, 7]);
    });

    test("assigned_by_me filters by createdBy and excludes self-assignee", async () => {
      pool.query.mockResolvedValueOnce([[]]);
      await listTasksForDashboard({ id: 7, role: 2 }, { bucket: "assigned_by_me" });
      expect(String(pool.query.mock.calls[0][0])).toContain("`createdBy` = ? AND `assignee` <> ?");
      expect(pool.query.mock.calls[0][1]).toEqual([7, 7]);
    });

    test("admin assigned_to_me filters by admin user id", async () => {
      pool.query.mockResolvedValueOnce([[]]);
      await listTasksForDashboard({ id: 1, role: 1 }, { bucket: "assigned_to_me" });
      expect(String(pool.query.mock.calls[0][0])).toContain("`assignee` = ? OR `followUpPerson` = ?");
      expect(pool.query.mock.calls[0][1]).toEqual([1, 1]);
    });

    test("admin assigned_by_me filters by admin user id", async () => {
      pool.query.mockResolvedValueOnce([[]]);
      await listTasksForDashboard({ id: 1, role: 1 }, { bucket: "assigned_by_me" });
      expect(String(pool.query.mock.calls[0][0])).toContain("`createdBy` = ? AND `assignee` <> ?");
      expect(pool.query.mock.calls[0][1]).toEqual([1, 1]);
    });
  });

  describe("buildDueCalendarGrid", () => {
    test("marks overdue, today, and upcoming cells", () => {
      const grid = buildDueCalendarGrid("2026-06-13", {
        "2026-06-10": 1,
        "2026-06-13": 2,
        "2026-06-20": 1
      });
      expect(grid.monthLabel).toMatch(/June 2026/);
      const overdue = grid.cells.find((c) => c.date === "2026-06-10");
      const today = grid.cells.find((c) => c.date === "2026-06-13");
      const upcoming = grid.cells.find((c) => c.date === "2026-06-20");
      expect(overdue?.tone).toBe("overdue");
      expect(today?.tone).toBe("today");
      expect(upcoming?.tone).toBe("upcoming");
    });
  });

  describe("appendTaskAlertsScope", () => {
    test("combines assigned-to-me and assigned-by-me buckets for regular user", () => {
      const whereParts = [];
      const whereValues = [];
      appendTaskAlertsScope({ id: 7, role: 2 }, whereParts, whereValues);
      expect(whereParts.join(" ")).toContain("`assignee` = ? OR `followUpPerson` = ?");
      expect(whereParts.join(" ")).toContain("`createdBy` = ? AND `assignee` <> ?");
      expect(whereValues).toEqual([7, 7, 7, 7]);
    });
  });

  describe("loadTaskAlerts", () => {
    test("returns summed counts and open due/overdue items across both buckets", async () => {
      pool.query
        .mockResolvedValueOnce([
          [
            {
              totalTasks: 3,
              completedTasks: 0,
              workInProgress: 1,
              pendingTasks: 2,
              cancelledTasks: 0,
              overdueTasks: 2,
              dueToday: 1,
              dueThisWeek: 0,
              highPriorityOpen: 0,
              finishedLastWeek: 0
            }
          ]
        ])
        .mockResolvedValueOnce([
          [
            {
              totalTasks: 1,
              completedTasks: 0,
              workInProgress: 0,
              pendingTasks: 1,
              cancelledTasks: 0,
              overdueTasks: 1,
              dueToday: 0,
              dueThisWeek: 0,
              highPriorityOpen: 0,
              finishedLastWeek: 0
            }
          ]
        ])
        .mockResolvedValueOnce([
          [
            {
              id: 1,
              taskTitle: "Overdue",
              dueDate: "2026-06-01",
              status: "In Progress"
            },
            {
              id: 2,
              taskTitle: "Today",
              dueDate: "2026-06-13",
              status: "Pending"
            }
          ]
        ]);

      const alerts = await loadTaskAlerts({ id: 7, role: 2 });

      expect(alerts).toEqual({
        overdueCount: 3,
        dueTodayCount: 1,
        alertCount: 4,
        items: [
          expect.objectContaining({ id: 1, taskTitle: "Overdue", isOverdue: true, status: "In Progress" }),
          expect.objectContaining({ id: 2, taskTitle: "Today", isOverdue: false, status: "Pending" })
        ]
      });

      const [itemsSql, itemsValues] = pool.query.mock.calls[2];
      expect(itemsSql).toContain("`status` NOT IN ('Completed', 'Cancelled')");
      expect(itemsSql).toContain("DATE(`dueDate`) <= CURDATE()");
      expect(itemsSql).toContain("`assignee` = ? OR `followUpPerson` = ?");
      expect(itemsSql).toContain("`createdBy` = ? AND `assignee` <> ?");
      expect(itemsValues).toEqual([7, 7, 7, 7, 10]);
    });
  });

  describe("loadTaskDashboardSummary", () => {
    test("returns open counts, metrics, and calendar per bucket", async () => {
      pool.query
        .mockResolvedValueOnce([[{ status: "Pending", cnt: 2 }, { status: "Completed", cnt: 5 }]])
        .mockResolvedValueOnce([[{ status: "In Progress", cnt: 1 }]])
        .mockResolvedValueOnce([
          [
            {
              totalTasks: 7,
              completedTasks: 5,
              workInProgress: 0,
              pendingTasks: 2,
              cancelledTasks: 0,
              overdueTasks: 1,
              dueToday: 1,
              dueThisWeek: 2,
              highPriorityOpen: 1,
              finishedLastWeek: 3
            }
          ]
        ])
        .mockResolvedValueOnce([
          [
            {
              totalTasks: 1,
              completedTasks: 0,
              workInProgress: 1,
              pendingTasks: 0,
              cancelledTasks: 0,
              overdueTasks: 0,
              finishedLastWeek: 0
            }
          ]
        ])
        .mockResolvedValueOnce([[{ dueDay: "2026-06-13", cnt: 1 }]])
        .mockResolvedValueOnce([[{ cnt: 2 }]]);

      const summary = await loadTaskDashboardSummary({ id: 7, role: 2 });
      expect(summary.assignedToMe.openCount).toBe(2);
      expect(summary.assignedByMe.openCount).toBe(1);
      expect(summary.assignedToMe.metrics.totalTasks).toBe(7);
      expect(summary.assignedToMe.metrics.overdueTasks).toBe(1);
      expect(summary.assignedToMe.metrics.finishedLastWeek).toBe(3);
      expect(summary.assignedToMe.metrics.dueToday).toBe(1);
      expect(summary.assignedToMe.metrics.highPriorityOpen).toBe(1);
      expect(summary.assignedToMe.metrics.completionRate).toBeCloseTo(71.4, 1);
      expect(summary.assignedToMe.calendar.monthLabel).toMatch(/June 2026/);
      expect(summary.assignedToMe.calendar.noDueDateCount).toBe(2);
    });
  });

  describe("getStatusCountsForBucket", () => {
    test("returns statusCounts and total", async () => {
      pool.query.mockResolvedValueOnce([[{ status: "Pending", cnt: 3 }]]);
      const result = await getStatusCountsForBucket({ id: 7, role: 2 }, "assigned_to_me");
      expect(result.statusCounts.Pending).toBe(3);
      expect(result.total).toBe(3);
    });
  });

  describe("createTaskFromDashboard", () => {
    test("passes keysInRequest array to validateCrudPayloadForWrite", async () => {
      validateCrudPayloadForWrite.mockReturnValueOnce("Task title is required.");
      const result = await createTaskFromDashboard({ id: 1, role: 2 }, { assignee: 5 });
      expect(result.status).toBe(400);
      expect(validateCrudPayloadForWrite).toHaveBeenCalledWith(
        expect.objectContaining({ table: "task_master" }),
        expect.any(Object),
        "create",
        expect.arrayContaining(["assignee"])
      );
    });
  });

  describe("updateTaskFromDashboard", () => {
    const baseRow = {
      id: 1,
      assignee: 5,
      createdBy: 10,
      status: "Pending",
      taskTitle: "T",
      description: "D",
      dueDate: "2026-06-20",
      priority: "Medium"
    };

    test("creator can update priority but not status", async () => {
      pool.query.mockResolvedValueOnce([[baseRow]]);
      const result = await updateTaskFromDashboard({ id: 10, role: 2 }, 1, { status: "Completed" });
      expect(result.status).toBe(403);
      expect(result.body.error).toMatch(/status/i);
    });

    test("assignee can update status but not taskTitle", async () => {
      pool.query.mockResolvedValueOnce([[baseRow]]);
      const result = await updateTaskFromDashboard({ id: 5, role: 2 }, 1, { taskTitle: "New" });
      expect(result.status).toBe(403);
      expect(result.body.error).toMatch(/details/i);
    });

    test("follow-up person cannot update status or details", async () => {
      const followRow = { ...baseRow, followUpPerson: 8 };
      pool.query.mockResolvedValueOnce([[followRow]]);
      const statusResult = await updateTaskFromDashboard({ id: 8, role: 2 }, 1, { status: "Completed" });
      expect(statusResult.status).toBe(403);
      pool.query.mockResolvedValueOnce([[followRow]]);
      const detailResult = await updateTaskFromDashboard({ id: 8, role: 2 }, 1, { priority: "High" });
      expect(detailResult.status).toBe(403);
    });

    test("creator can update priority", async () => {
      pool.query
        .mockResolvedValueOnce([[baseRow]])
        .mockResolvedValueOnce([[{ ...baseRow, priority: "High" }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);
      const result = await updateTaskFromDashboard({ id: 10, role: 2 }, 1, { priority: "High" });
      expect(result.status).toBe(200);
      expect(mockConnQuery).toHaveBeenCalled();
    });

    test("assignee can update status and comment", async () => {
      pool.query
        .mockResolvedValueOnce([[baseRow]])
        .mockResolvedValueOnce([[{ ...baseRow, status: "In Progress" }]])
        .mockResolvedValueOnce([[]])
        .mockResolvedValueOnce([[]]);
      const result = await updateTaskFromDashboard(
        { id: 5, role: 2 },
        1,
        { status: "In Progress", commentText: "Done part 1" }
      );
      expect(result.status).toBe(200);
    });
  });
});
