/**
 * Tests for lib/modules/task.js
 */

jest.mock("mysql2", () => ({
  escapeId: jest.fn((v) => `\`${String(v)}\``)
}));

jest.mock("../../lib/sqlModuleTable", () => ({
  escapeSqlTableId: jest.fn((t) => `\`${String(t)}\``)
}));

jest.mock("../../lib/istDateTime", () => ({
  formatInstantAsMysqlDatetimeIST: jest.fn(() => "2026-06-13 12:00:00"),
  getYmdISTFromInstant: jest.fn(() => "2026-06-13")
}));

const {
  stripServerOnlyChildRows,
  enrichNewCommentRows,
  applyTaskBeforeWrite,
  applyTaskAfterCreateWrite,
  applyTaskAfterUpdateWrite,
  insertActivityLogRow,
  assertTaskMasterUpdateAllowed
} = require("../../lib/modules/task");

describe("task module", () => {
  let conn;

  beforeEach(() => {
    jest.clearAllMocks();
    conn = { query: jest.fn().mockResolvedValue([[{ id: 5 }]]) };
  });

  test("stripServerOnlyChildRows removes status_history and activity_log", () => {
    const input = {
      comments: [{ commentText: "hi" }],
      status_history: [{ toStatus: "Done" }],
      activity_log: [{ fieldName: "status" }]
    };
    const out = stripServerOnlyChildRows(input);
    expect(out.comments).toEqual([{ commentText: "hi" }]);
    expect(out.status_history).toBeUndefined();
    expect(out.activity_log).toBeUndefined();
  });

  test("enrichNewCommentRows stamps commentedBy and commentedAt on new rows", () => {
    const childTableRows = {
      comments: [{ commentText: "  note  " }, { id: 9, commentText: "old" }, { commentText: "" }]
    };
    enrichNewCommentRows(childTableRows, 7);
    expect(childTableRows.comments[0]).toEqual({
      commentText: "note",
      commentedBy: 7,
      commentedAt: "2026-06-13 12:00:00"
    });
    expect(childTableRows.comments[1]).toEqual({ id: 9, commentText: "old" });
    expect(childTableRows.comments[2]).toEqual({ commentText: "" });
  });

  test("applyTaskBeforeWrite rejects missing assignee", async () => {
    await expect(
      applyTaskBeforeWrite(conn, { user: { id: 1 }, merged: {}, childTableRows: {} })
    ).rejects.toMatchObject({ code: "TASK_VALIDATION_FAILED", message: "Assignee is required." });
  });

  test("applyTaskBeforeWrite rejects inactive assignee", async () => {
    conn.query.mockResolvedValueOnce([[]]);
    await expect(
      applyTaskBeforeWrite(conn, { user: { id: 1 }, merged: { assignee: 99 }, childTableRows: {} })
    ).rejects.toMatchObject({ code: "TASK_VALIDATION_FAILED", message: "Assignee must be an active user." });
  });

  test("applyTaskBeforeWrite rejects followUpPerson same as assignee", async () => {
    await expect(
      applyTaskBeforeWrite(conn, {
        user: { id: 1 },
        merged: { assignee: 5, followUpPerson: 5 },
        childTableRows: {}
      })
    ).rejects.toMatchObject({
      code: "TASK_VALIDATION_FAILED",
      message: "Follow-up person cannot be the same as the assignee."
    });
  });

  test("applyTaskBeforeWrite rejects past due date", async () => {
    await expect(
      applyTaskBeforeWrite(conn, {
        user: { id: 1 },
        merged: { dueDate: "2020-01-01", assignee: 5 },
        childTableRows: {}
      })
    ).rejects.toMatchObject({
      code: "TASK_VALIDATION_FAILED",
      message: "Due date cannot be in the past."
    });
  });

  test("applyTaskBeforeWrite allows update when due date unchanged and in past", async () => {
    await expect(
      applyTaskBeforeWrite(conn, {
        user: { id: 1, role: 2 },
        merged: { taskTitle: "Updated", dueDate: "2020-01-01", assignee: 5, createdBy: 1 },
        childTableRows: {},
        oldRow: { createdBy: 1, assignee: 5, status: "Pending", dueDate: "2020-01-01", taskTitle: "Old" }
      })
    ).resolves.toBeUndefined();
  });

  test("applyTaskBeforeWrite strips status_history and enriches comments", async () => {
    const childTableRows = {
      status_history: [{ toStatus: "X" }],
      comments: [{ commentText: "hello" }]
    };
    await applyTaskBeforeWrite(conn, {
      user: { id: 3 },
      merged: { assignee: 5 },
      childTableRows
    });
    expect(childTableRows.status_history).toBeUndefined();
    expect(childTableRows.comments[0].commentedBy).toBe(3);
  });

  test("applyTaskAfterCreateWrite inserts initial status activity", async () => {
    await applyTaskAfterCreateWrite(conn, {
      user: { id: 2 },
      merged: { status: "Pending" },
      insertId: 10
    });
    expect(conn.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO `task_activity_log`"),
      [10, "status", null, "Pending", 2, "2026-06-13 12:00:00"]
    );
  });

  test("applyTaskAfterUpdateWrite inserts activity when status changes", async () => {
    await applyTaskAfterUpdateWrite(conn, {
      user: { id: 2 },
      oldRow: { status: "Pending" },
      merged: { status: "In Progress" },
      id: 10
    });
    expect(conn.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO `task_activity_log`"),
      [10, "status", "Pending", "In Progress", 2, "2026-06-13 12:00:00"]
    );
  });

  test("applyTaskAfterUpdateWrite logs dueDate and priority changes", async () => {
    await applyTaskAfterUpdateWrite(conn, {
      user: { id: 2 },
      oldRow: { status: "Pending", dueDate: "2026-06-10", priority: "Medium" },
      merged: { status: "Pending", dueDate: "2026-06-15", priority: "High" },
      id: 10
    });
    expect(conn.query).toHaveBeenCalledTimes(2);
    expect(conn.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO `task_activity_log`"),
      [10, "dueDate", "2026-06-10", "2026-06-15", 2, "2026-06-13 12:00:00"]
    );
    expect(conn.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO `task_activity_log`"),
      [10, "priority", "Medium", "High", 2, "2026-06-13 12:00:00"]
    );
  });

  test("applyTaskAfterUpdateWrite skips activity when nothing changed", async () => {
    await applyTaskAfterUpdateWrite(conn, {
      user: { id: 2 },
      oldRow: { status: "Pending", dueDate: "2026-06-10", priority: "Medium" },
      merged: { status: "Pending", dueDate: "2026-06-10", priority: "Medium" },
      id: 10
    });
    expect(conn.query).not.toHaveBeenCalled();
  });

  test("insertActivityLogRow no-ops without task id", async () => {
    await insertActivityLogRow(conn, { taskId: null, fieldName: "status", toValue: "Done", changedBy: 1 });
    expect(conn.query).not.toHaveBeenCalled();
  });

  test("assertTaskMasterUpdateAllowed blocks assignee from editing task details", () => {
    expect(() =>
      assertTaskMasterUpdateAllowed({
        user: { id: 5, role: 2 },
        oldRow: { assignee: 5, createdBy: 10, taskTitle: "Old", status: "Pending" },
        merged: { assignee: 5, taskTitle: "New", status: "Pending" }
      })
    ).toThrow(/creator can edit task details/i);
  });

  test("assertTaskMasterUpdateAllowed blocks creator from changing status", () => {
    expect(() =>
      assertTaskMasterUpdateAllowed({
        user: { id: 10, role: 2 },
        oldRow: { assignee: 5, createdBy: 10, taskTitle: "T", status: "Pending" },
        merged: { assignee: 5, taskTitle: "T", status: "Completed" }
      })
    ).toThrow(/assignee can change task status/i);
  });

  test("assertTaskMasterUpdateAllowed allows follow-up person to comment-only path without detail edits", () => {
    expect(() =>
      assertTaskMasterUpdateAllowed({
        user: { id: 8, role: 2 },
        oldRow: { assignee: 5, createdBy: 10, followUpPerson: 8, taskTitle: "T", status: "Pending" },
        merged: { assignee: 5, followUpPerson: 8, taskTitle: "T", status: "Pending" }
      })
    ).not.toThrow();
  });
});
