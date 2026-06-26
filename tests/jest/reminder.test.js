/**
 * Tests for lib/modules/reminder.js
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
  computeNextDueDate,
  applyReminderBeforeWrite,
  applyReminderAfterCreateWrite,
  applyReminderAfterUpdateWrite,
  insertActivityLogRow,
  assertReminderMasterUpdateAllowed
} = require("../../lib/modules/reminder");

describe("reminder module", () => {
  let conn;

  beforeEach(() => {
    jest.clearAllMocks();
    conn = { query: jest.fn().mockResolvedValue([[{ id: 5 }]]) };
  });

  test("stripServerOnlyChildRows removes activity_log", () => {
    const input = { activity_log: [{ fieldName: "status" }] };
    const out = stripServerOnlyChildRows(input);
    expect(out.activity_log).toBeUndefined();
  });

  test("computeNextDueDate daily adds one day", () => {
    expect(computeNextDueDate("2026-06-13", "Daily")).toBe("2026-06-14");
  });

  test("computeNextDueDate weekly adds seven days", () => {
    expect(computeNextDueDate("2026-06-13", "Weekly")).toBe("2026-06-20");
  });

  test("computeNextDueDate monthly clamps day-of-month", () => {
    expect(computeNextDueDate("2026-01-31", "Monthly")).toBe("2026-02-28");
  });

  test("computeNextDueDate yearly handles leap year", () => {
    expect(computeNextDueDate("2024-02-29", "Yearly")).toBe("2025-02-28");
  });

  test("computeNextDueDate none returns null", () => {
    expect(computeNextDueDate("2026-06-13", "None")).toBeNull();
  });

  test("applyReminderBeforeWrite rejects recurring without due date", async () => {
    await expect(
      applyReminderBeforeWrite(conn, {
        user: { id: 1 },
        merged: { recurrenceType: "Daily" },
        childTableRows: {}
      })
    ).rejects.toMatchObject({
      code: "REMINDER_VALIDATION_FAILED",
      message: "Due date is required when recurrence is set."
    });
  });

  test("applyReminderBeforeWrite rejects past due date", async () => {
    await expect(
      applyReminderBeforeWrite(conn, {
        user: { id: 1 },
        merged: { dueDate: "2020-01-01" },
        childTableRows: {}
      })
    ).rejects.toMatchObject({
      code: "REMINDER_VALIDATION_FAILED",
      message: "Due date cannot be in the past."
    });
  });

  test("applyReminderBeforeWrite allows status change when due date unchanged and in past", async () => {
    await expect(
      applyReminderBeforeWrite(conn, {
        user: { id: 1, role: 2 },
        merged: { status: "Completed", dueDate: "2020-01-01", recurrenceType: "None" },
        childTableRows: {},
        oldRow: { createdBy: 1, status: "Pending", dueDate: "2020-01-01", recurrenceType: "None" }
      })
    ).resolves.toBeUndefined();
  });

  test("applyReminderBeforeWrite stamps createdBy on create", async () => {
    await applyReminderBeforeWrite(conn, {
      user: { id: 7 },
      merged: { reminderTitle: "Test" },
      childTableRows: {}
    });
    expect(conn.query).not.toHaveBeenCalled();
  });

  test("applyReminderAfterCreateWrite inserts initial status activity", async () => {
    await applyReminderAfterCreateWrite(conn, {
      user: { id: 2 },
      merged: { status: "Pending" },
      insertId: 10
    });
    expect(conn.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO `reminder_activity_log`"),
      [10, "status", null, "Pending", 2, "2026-06-13 12:00:00"]
    );
  });

  test("applyReminderAfterUpdateWrite logs status changes", async () => {
    await applyReminderAfterUpdateWrite(conn, {
      user: { id: 2 },
      oldRow: { status: "Pending" },
      merged: { status: "Completed" },
      id: 10
    });
    expect(conn.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO `reminder_activity_log`"),
      [10, "status", "Pending", "Completed", 2, "2026-06-13 12:00:00"]
    );
  });

  test("assertReminderMasterUpdateAllowed rejects non-owner", () => {
    expect(() =>
      assertReminderMasterUpdateAllowed({
        user: { id: 2, role: 2 },
        oldRow: { createdBy: 5 },
        merged: {}
      })
    ).toThrow("Not allowed to update this reminder.");
  });

  test("insertActivityLogRow skips empty toValue", async () => {
    await insertActivityLogRow(conn, {
      reminderId: 1,
      fieldName: "status",
      fromValue: null,
      toValue: "",
      changedBy: 2
    });
    expect(conn.query).not.toHaveBeenCalled();
  });
});
