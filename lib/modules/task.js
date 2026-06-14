/**
 * Task Management — server rules for task_master.
 * Assignee validation, server-only activity log, append-only comments.
 */

import mysql from "mysql2";
import { escapeSqlTableId } from "../sqlModuleTable";
import { formatInstantAsMysqlDatetimeIST } from "../istDateTime";

function asPositiveInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function throwTaskValidation(message) {
  throw Object.assign(new Error(message), { code: "TASK_VALIDATION_FAILED" });
}

function normalizeSyncMode(ct) {
  const m = String(ct?.syncMode || "replace").trim().toLowerCase();
  if (m === "append" || m === "serveronly" || m === "server_only") {
    return m === "server_only" ? "serverOnly" : m === "serveronly" ? "serverOnly" : m;
  }
  return "replace";
}

async function assertActiveUser(conn, userId, label = "User") {
  const id = asPositiveInt(userId);
  if (!id) return null;
  const usersTable = escapeSqlTableId("users");
  const [rows] = await conn.query(
    `SELECT id FROM ${usersTable} WHERE id = ? AND LOWER(TRIM(COALESCE(active, ''))) = 'yes' LIMIT 1`,
    [id]
  );
  if (!rows?.length) {
    throwTaskValidation(`${label} must be an active user.`);
  }
  return id;
}

async function assertAssigneeActive(conn, assigneeId) {
  const id = asPositiveInt(assigneeId);
  if (!id) throwTaskValidation("Assignee is required.");
  return assertActiveUser(conn, id, "Assignee");
}

async function assertFollowUpPersonValid(conn, followUpPersonId, assigneeId) {
  const followUp = followUpPersonId == null || followUpPersonId === "" ? null : asPositiveInt(followUpPersonId);
  if (!followUp) return null;
  if (Number(followUp) === Number(assigneeId)) {
    throwTaskValidation("Follow-up person cannot be the same as the assignee.");
  }
  return assertActiveUser(conn, followUp, "Follow-up person");
}

/** Remove server-managed child rows from client payload. */
export function stripServerOnlyChildRows(childTableRows) {
  if (!childTableRows || typeof childTableRows !== "object") return childTableRows;
  delete childTableRows.status_history;
  delete childTableRows.activity_log;
  return childTableRows;
}

/** Stamp commentedBy / commentedAt on new comment rows before append sync. */
export function enrichNewCommentRows(childTableRows, userId) {
  if (!childTableRows?.comments || !Array.isArray(childTableRows.comments)) return;
  const now = formatInstantAsMysqlDatetimeIST();
  const uid = asPositiveInt(userId);
  if (!uid) return;

  childTableRows.comments = childTableRows.comments.map((row) => {
    if (!row || typeof row !== "object") return row;
    const hasId = row.id != null && String(row.id).trim() !== "" && Number.isFinite(Number(row.id));
    if (hasId) return row;
    const text = String(row.commentText ?? "").trim();
    if (!text) return row;
    return {
      ...row,
      commentText: text,
      commentedBy: uid,
      commentedAt: now
    };
  });
}

function normalizeActivityValue(value) {
  if (value == null || value === "") return "";
  return String(value).trim();
}

export async function insertActivityLogRow(conn, { taskId, fieldName, fromValue, toValue, changedBy }) {
  const tid = asPositiveInt(taskId);
  const uid = asPositiveInt(changedBy);
  const field = String(fieldName ?? "").trim();
  const to = normalizeActivityValue(toValue);
  if (!tid || !uid || !field || !to) return;
  const from = fromValue == null || normalizeActivityValue(fromValue) === "" ? null : normalizeActivityValue(fromValue);
  const now = formatInstantAsMysqlDatetimeIST();
  const table = escapeSqlTableId("task_activity_log");
  await conn.query(
    `INSERT INTO ${table} (${mysql.escapeId("taskId")}, ${mysql.escapeId("fieldName")}, ${mysql.escapeId("fromValue")}, ${mysql.escapeId("toValue")}, ${mysql.escapeId("changedBy")}, ${mysql.escapeId("changedAt")}) VALUES (?, ?, ?, ?, ?, ?)`,
    [tid, field, from, to, uid, now]
  );
}

const TRACKED_ACTIVITY_FIELDS = ["status", "dueDate", "priority", "followUpPerson"];

async function logFieldChanges(conn, { taskId, oldRow, merged, changedBy }) {
  for (const field of TRACKED_ACTIVITY_FIELDS) {
    const prev = normalizeActivityValue(oldRow?.[field]);
    const next = normalizeActivityValue(merged?.[field]);
    if (next !== prev) {
      await insertActivityLogRow(conn, {
        taskId,
        fieldName: field,
        fromValue: prev || null,
        toValue: next,
        changedBy
      });
    }
  }
}

function isAdminUser(user) {
  return user && Number(user.role) === 1;
}

function taskUserId(user) {
  const n = Number(user?.id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const TASK_DETAIL_FIELDS = ["taskTitle", "description", "dueDate", "priority", "assignee", "followUpPerson"];

/**
 * Enforce creator vs assignee field rules on task_master updates (dashboard + CRUD).
 */
export function assertTaskMasterUpdateAllowed({ user, oldRow, merged }) {
  if (!oldRow || isAdminUser(user)) return;

  const uid = taskUserId(user);
  if (!uid) throwTaskValidation("Not allowed to update this task.");

  const isCreator = Number(oldRow.createdBy) === uid;
  const isAssignee = Number(oldRow.assignee) === uid;
  const isFollowUp = Number(oldRow.followUpPerson) === uid;

  if (!isCreator && !isAssignee && !isFollowUp) {
    throwTaskValidation("Not allowed to update this task.");
  }

  if (Number(merged?.assignee) !== Number(oldRow.assignee) && !isAdminUser(user)) {
    throwTaskValidation("Assignee cannot be changed after creation.");
  }

  const statusChanged =
    merged?.status != null &&
    String(merged.status).trim() !== String(oldRow.status ?? "").trim();

  if (statusChanged && !isAssignee) {
    throwTaskValidation("Only the assignee can change task status.");
  }

  if ((isAssignee || isFollowUp) && !isCreator) {
    for (const field of TASK_DETAIL_FIELDS) {
      if (field === "assignee") continue;
      const next = merged?.[field];
      const prev = oldRow?.[field];
      if (next !== undefined && String(next ?? "") !== String(prev ?? "")) {
        throwTaskValidation("Only the task creator can edit task details.");
      }
    }
  }

  if (isCreator && !isAssignee && statusChanged) {
    throwTaskValidation("Only the assignee can change task status.");
  }
}

/**
 * Shared before-write validation for create and update.
 */
export async function applyTaskBeforeWrite(conn, { user, merged, childTableRows, oldRow = null }) {
  await assertAssigneeActive(conn, merged?.assignee);
  await assertFollowUpPersonValid(conn, merged?.followUpPerson, merged?.assignee);

  if (oldRow) {
    assertTaskMasterUpdateAllowed({ user, oldRow, merged });
  }

  if (childTableRows && typeof childTableRows === "object") {
    stripServerOnlyChildRows(childTableRows);
    enrichNewCommentRows(childTableRows, user?.id);
  }
}

export async function applyTaskAfterCreateWrite(conn, { user, merged, insertId }) {
  const status = String(merged?.status ?? "Pending").trim() || "Pending";
  await insertActivityLogRow(conn, {
    taskId: insertId,
    fieldName: "status",
    fromValue: null,
    toValue: status,
    changedBy: user?.id
  });
}

export async function applyTaskAfterUpdateWrite(conn, { user, oldRow, merged, id }) {
  await logFieldChanges(conn, {
    taskId: id,
    oldRow,
    merged,
    changedBy: user?.id
  });
}

export { normalizeSyncMode };
