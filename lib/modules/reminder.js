/**
 * Reminder Management — server rules for reminder_master.
 * Self-reminder ownership, activity log, recurrence spawn helpers.
 */

import mysql from "mysql2";
import { escapeSqlTableId } from "../sqlModuleTable";
import { formatInstantAsMysqlDatetimeIST, getYmdISTFromInstant } from "../istDateTime";
import { applyCreateAudit } from "../crudRecordAudit";

export const REMINDER_STATUSES = ["Pending", "Completed", "Cancelled"];
export const RECURRENCE_TYPES = ["None", "Daily", "Weekly", "Monthly", "Yearly"];

function asPositiveInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function throwReminderValidation(message) {
  throw Object.assign(new Error(message), { code: "REMINDER_VALIDATION_FAILED" });
}

function isAdminUser(user) {
  return user && Number(user.role) === 1;
}

function reminderUserId(user) {
  const n = Number(user?.id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeSyncMode(ct) {
  const m = String(ct?.syncMode || "replace").trim().toLowerCase();
  if (m === "append" || m === "serveronly" || m === "server_only") {
    return m === "server_only" ? "serverOnly" : m === "serveronly" ? "serverOnly" : m;
  }
  return "replace";
}

function normalizeActivityValue(value) {
  if (value == null || value === "") return "";
  return String(value).trim();
}

function normalizeRecurrenceType(value) {
  const v = String(value ?? "None").trim();
  return RECURRENCE_TYPES.includes(v) ? v : "None";
}

function normalizeYmd(value) {
  if (value == null || value === "") return null;
  const s = String(value).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function todayYmd() {
  return getYmdISTFromInstant(new Date());
}

function assertDateNotInPast(ymd, label) {
  if (!ymd) return;
  const today = todayYmd();
  if (ymd < today) {
    throwReminderValidation(`${label} cannot be in the past.`);
  }
}

function assertRecurrenceDueDate(merged) {
  const rt = normalizeRecurrenceType(merged?.recurrenceType);
  if (rt !== "None" && !normalizeYmd(merged?.dueDate)) {
    throwReminderValidation("Due date is required when recurrence is set.");
  }
}

/** Remove server-managed child rows from client payload. */
export function stripServerOnlyChildRows(childTableRows) {
  if (!childTableRows || typeof childTableRows !== "object") return childTableRows;
  delete childTableRows.activity_log;
  return childTableRows;
}

export async function insertActivityLogRow(conn, { reminderId, fieldName, fromValue, toValue, changedBy }) {
  const rid = asPositiveInt(reminderId);
  const uid = asPositiveInt(changedBy);
  const field = String(fieldName ?? "").trim();
  const to = normalizeActivityValue(toValue);
  if (!rid || !uid || !field || !to) return;
  const from = fromValue == null || normalizeActivityValue(fromValue) === "" ? null : normalizeActivityValue(fromValue);
  const now = formatInstantAsMysqlDatetimeIST();
  const table = escapeSqlTableId("reminder_activity_log");
  await conn.query(
    `INSERT INTO ${table} (${mysql.escapeId("reminderId")}, ${mysql.escapeId("fieldName")}, ${mysql.escapeId("fromValue")}, ${mysql.escapeId("toValue")}, ${mysql.escapeId("changedBy")}, ${mysql.escapeId("changedAt")}) VALUES (?, ?, ?, ?, ?, ?)`,
    [rid, field, from, to, uid, now]
  );
}

const TRACKED_ACTIVITY_FIELDS = ["status", "dueDate", "recurrenceType"];

async function logFieldChanges(conn, { reminderId, oldRow, merged, changedBy }) {
  for (const field of TRACKED_ACTIVITY_FIELDS) {
    const prev = normalizeActivityValue(oldRow?.[field]);
    const next = normalizeActivityValue(merged?.[field]);
    if (next !== prev) {
      await insertActivityLogRow(conn, {
        reminderId,
        fieldName: field,
        fromValue: prev || null,
        toValue: next,
        changedBy
      });
    }
  }
}

/**
 * Compute next due date from a YYYY-MM-DD base and recurrence type.
 */
export function computeNextDueDate(dueDate, recurrenceType) {
  const ymd = normalizeYmd(dueDate);
  const rt = normalizeRecurrenceType(recurrenceType);
  if (!ymd || rt === "None") return null;

  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;

  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);

  if (rt === "Daily") {
    const dt = new Date(Date.UTC(y, mo - 1, d));
    dt.setUTCDate(dt.getUTCDate() + 1);
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
  }

  if (rt === "Weekly") {
    const dt = new Date(Date.UTC(y, mo - 1, d));
    dt.setUTCDate(dt.getUTCDate() + 7);
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
  }

  if (rt === "Monthly") {
    let nextMo = mo + 1;
    let nextY = y;
    if (nextMo > 12) {
      nextMo = 1;
      nextY += 1;
    }
    const lastDay = new Date(Date.UTC(nextY, nextMo, 0)).getUTCDate();
    const nextD = Math.min(d, lastDay);
    return `${nextY}-${String(nextMo).padStart(2, "0")}-${String(nextD).padStart(2, "0")}`;
  }

  if (rt === "Yearly") {
    let nextY = y + 1;
    const nextMo = mo;
    let nextD = d;
    if (mo === 2 && d === 29) {
      const isLeap = (nextY % 4 === 0 && nextY % 100 !== 0) || nextY % 400 === 0;
      if (!isLeap) nextD = 28;
    }
    return `${nextY}-${String(nextMo).padStart(2, "0")}-${String(nextD).padStart(2, "0")}`;
  }

  return null;
}

/**
 * Insert next Pending occurrence after complete (same transaction).
 */
export async function spawnNextOccurrence(conn, { completedRow, user }) {
  const rt = normalizeRecurrenceType(completedRow?.recurrenceType);
  const due = normalizeYmd(completedRow?.dueDate);
  if (rt === "None" || !due) return null;

  const nextDue = computeNextDueDate(due, rt);
  if (!nextDue) return null;

  const uid = reminderUserId(user);
  const seriesRootId = asPositiveInt(completedRow.seriesRootId) || asPositiveInt(completedRow.id);
  const table = escapeSqlTableId("reminder_master");

  let insertRow = {
    reminderTitle: completedRow.reminderTitle,
    notes: completedRow.notes ?? null,
    dueDate: nextDue,
    recurrenceType: rt,
    status: "Pending",
    seriesRootId,
    spawnedFromId: completedRow.id,
    createdBy: completedRow.createdBy
  };
  insertRow = applyCreateAudit(insertRow, uid, {
    createdBy: "createdBy",
    createdAt: "createdDate",
    modifiedBy: "modifiedBy",
    modifiedAt: "modifiedDate"
  });

  const cols = Object.keys(insertRow).filter((k) => insertRow[k] !== undefined);
  const placeholders = cols.map(() => "?").join(", ");
  const [result] = await conn.query(
    `INSERT INTO ${table} (${cols.map((c) => mysql.escapeId(c)).join(", ")}) VALUES (${placeholders})`,
    cols.map((c) => insertRow[c])
  );
  const newId = Number(result.insertId);

  await insertActivityLogRow(conn, {
    reminderId: completedRow.id,
    fieldName: "spawned",
    fromValue: null,
    toValue: String(newId),
    changedBy: uid
  });

  await insertActivityLogRow(conn, {
    reminderId: newId,
    fieldName: "status",
    fromValue: null,
    toValue: "Pending",
    changedBy: uid
  });

  return { id: newId, ...insertRow };
}

export function assertReminderMasterUpdateAllowed({ user, oldRow, merged }) {
  if (!oldRow || isAdminUser(user)) return;

  const uid = reminderUserId(user);
  if (!uid) throwReminderValidation("Not allowed to update this reminder.");
  if (Number(oldRow.createdBy) !== uid) {
    throwReminderValidation("Not allowed to update this reminder.");
  }

  if (merged?.seriesRootId !== undefined && Number(merged.seriesRootId) !== Number(oldRow.seriesRootId)) {
    throwReminderValidation("Series link cannot be changed.");
  }
  if (merged?.spawnedFromId !== undefined && Number(merged.spawnedFromId) !== Number(oldRow.spawnedFromId)) {
    throwReminderValidation("Spawn link cannot be changed.");
  }
  if (merged?.createdBy !== undefined && Number(merged.createdBy) !== Number(oldRow.createdBy)) {
    throwReminderValidation("Owner cannot be changed.");
  }
}

export async function applyReminderBeforeWrite(conn, { user, merged, childTableRows, oldRow = null }) {
  const isCreate = !oldRow;
  if (merged.recurrenceType !== undefined) {
    merged.recurrenceType = normalizeRecurrenceType(merged.recurrenceType);
  } else if (isCreate) {
    merged.recurrenceType = "None";
  }

  if (merged.status !== undefined) {
    const st = String(merged.status).trim();
    if (!REMINDER_STATUSES.includes(st)) {
      throwReminderValidation("Invalid status.");
    }
    merged.status = st;
  }

  if (merged.dueDate !== undefined) {
    merged.dueDate = normalizeYmd(merged.dueDate);
    const dueDateChanged = !oldRow || normalizeYmd(oldRow.dueDate) !== merged.dueDate;
    if (dueDateChanged && merged.dueDate) assertDateNotInPast(merged.dueDate, "Due date");
  }

  assertRecurrenceDueDate(merged);

  if (isCreate) {
    const uid = reminderUserId(user);
    if (!uid) throwReminderValidation("User is required.");
    if (!isAdminUser(user) || merged.createdBy == null || merged.createdBy === "") {
      merged.createdBy = uid;
    }
    delete merged.seriesRootId;
    delete merged.spawnedFromId;
  } else if (oldRow) {
    assertReminderMasterUpdateAllowed({ user, oldRow, merged });
  }

  if (childTableRows && typeof childTableRows === "object") {
    stripServerOnlyChildRows(childTableRows);
  }
}

export async function applyReminderAfterCreateWrite(conn, { user, merged, insertId }) {
  const status = String(merged?.status ?? "Pending").trim() || "Pending";
  await insertActivityLogRow(conn, {
    reminderId: insertId,
    fieldName: "status",
    fromValue: null,
    toValue: status,
    changedBy: user?.id
  });
}

export async function applyReminderAfterUpdateWrite(conn, { user, oldRow, merged, id }) {
  await logFieldChanges(conn, {
    reminderId: id,
    oldRow,
    merged,
    changedBy: user?.id
  });
}

export { normalizeSyncMode };
