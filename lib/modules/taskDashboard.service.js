/**
 * Task dashboard service — list/create/update for My Tasks widget (/api/task).
 * Uses config/modules.js task_master for field definitions; gated by dashboard_my_tasks permission.
 */

import mysql from "mysql2";
import { modules } from "../../config/modules";
import pool from "../db";
import { escapeSqlTableIdForModuleConfig } from "../sqlModuleTable";
import { loadChildTableRowsForParent } from "../childTablesLoad";
import { validateCrudPayloadForWrite } from "../services/crudPayloadValidation";
import { normalizeCrudPayload } from "../crudNormalize";
import { applyCreateAudit, applyUpdateAudit, stripClientAuditFields } from "../crudRecordAudit";
import {
  applyTaskBeforeWrite,
  applyTaskAfterCreateWrite,
  applyTaskAfterUpdateWrite,
  enrichNewCommentRows
} from "./task";
import { formatInstantAsMysqlDatetimeIST, getYmdISTFromInstant } from "../istDateTime";

export const TASK_STATUSES = ["Pending", "In Progress", "Completed", "Cancelled"];
const CLOSED_STATUSES = new Set(["Completed", "Cancelled"]);

function moduleConfig() {
  return modules.task_master;
}

function isAdmin(user) {
  return user && Number(user.role) === 1;
}

function tableRef() {
  return escapeSqlTableIdForModuleConfig(moduleConfig());
}

function asPositiveInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeBucket(raw) {
  const b = String(raw || "assigned_to_me").trim().toLowerCase();
  return b === "assigned_by_me" ? "assigned_by_me" : "assigned_to_me";
}

function getWritableFieldNames(cfg) {
  return (cfg.fields || []).filter((f) => !f.excludeFromForm).map((f) => f.name);
}

/**
 * SQL WHERE fragments for dashboard bucket filter.
 */
function appendBucketFilter(bucket, user, whereParts, whereValues) {
  const uid = asPositiveInt(user?.id);
  if (!uid) {
    whereParts.push("1=0");
    return;
  }

  if (bucket === "assigned_to_me") {
    whereParts.push(
      `(${mysql.escapeId("assignee")} = ? OR ${mysql.escapeId("followUpPerson")} = ?)`
    );
    whereValues.push(uid, uid);
    return;
  }

  whereParts.push(`${mysql.escapeId("createdBy")} = ? AND ${mysql.escapeId("assignee")} <> ?`);
  whereValues.push(uid, uid);
}

function emptyStatusCounts() {
  const o = {};
  for (const s of TASK_STATUSES) o[s] = 0;
  return o;
}

function rowsToStatusCounts(rows) {
  const counts = emptyStatusCounts();
  for (const r of rows || []) {
    const st = String(r.status ?? "").trim();
    if (Object.prototype.hasOwnProperty.call(counts, st)) {
      counts[st] += Number(r.cnt) || 0;
    }
  }
  return counts;
}

function countOpenTasks(statusCounts) {
  let n = 0;
  for (const [st, cnt] of Object.entries(statusCounts || {})) {
    if (!CLOSED_STATUSES.has(st)) n += Number(cnt) || 0;
  }
  return n;
}

async function queryStatusCounts(user, bucket) {
  const t = tableRef();
  const whereParts = [];
  const whereValues = [];
  appendBucketFilter(bucket, user, whereParts, whereValues);
  const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
  const [rows] = await pool.query(
    `SELECT ${mysql.escapeId("status")} AS status, COUNT(*) AS cnt FROM ${t} ${whereSql} GROUP BY ${mysql.escapeId("status")}`,
    whereValues
  );
  const statusCounts = rowsToStatusCounts(rows);
  return { statusCounts, total: Object.values(statusCounts).reduce((a, b) => a + b, 0) };
}

async function queryTaskMetrics(user, bucket) {
  const t = tableRef();
  const whereParts = [];
  const whereValues = [];
  appendBucketFilter(bucket, user, whereParts, whereValues);
  const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
  const statusCol = mysql.escapeId("status");
  const dueCol = mysql.escapeId("dueDate");
  const modCol = mysql.escapeId("modifiedDate");
  const priCol = mysql.escapeId("priority");
  const openFilter = `${statusCol} NOT IN ('Completed', 'Cancelled')`;
  const [rows] = await pool.query(
    `SELECT
      COUNT(*) AS totalTasks,
      SUM(CASE WHEN ${statusCol} = 'Completed' THEN 1 ELSE 0 END) AS completedTasks,
      SUM(CASE WHEN ${statusCol} = 'In Progress' THEN 1 ELSE 0 END) AS workInProgress,
      SUM(CASE WHEN ${statusCol} = 'Pending' THEN 1 ELSE 0 END) AS pendingTasks,
      SUM(CASE WHEN ${statusCol} = 'Cancelled' THEN 1 ELSE 0 END) AS cancelledTasks,
      SUM(CASE WHEN ${openFilter}
        AND ${dueCol} IS NOT NULL AND DATE(${dueCol}) < CURDATE() THEN 1 ELSE 0 END) AS overdueTasks,
      SUM(CASE WHEN ${openFilter}
        AND ${dueCol} IS NOT NULL AND DATE(${dueCol}) = CURDATE() THEN 1 ELSE 0 END) AS dueToday,
      SUM(CASE WHEN ${openFilter}
        AND ${dueCol} IS NOT NULL
        AND DATE(${dueCol}) > CURDATE()
        AND DATE(${dueCol}) <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS dueThisWeek,
      SUM(CASE WHEN ${openFilter} AND ${priCol} = 'High' THEN 1 ELSE 0 END) AS highPriorityOpen,
      SUM(CASE WHEN ${statusCol} = 'Completed'
        AND DATE(${modCol}) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS finishedLastWeek
    FROM ${t} ${whereSql}`,
    whereValues
  );
  const r = rows?.[0] || {};
  const totalTasks = Number(r.totalTasks) || 0;
  const completedTasks = Number(r.completedTasks) || 0;
  const cancelledTasks = Number(r.cancelledTasks) || 0;
  const activeTasks = Math.max(0, totalTasks - completedTasks - cancelledTasks);
  return {
    totalTasks,
    completedTasks,
    workInProgress: Number(r.workInProgress) || 0,
    pendingTasks: Number(r.pendingTasks) || 0,
    cancelledTasks,
    overdueTasks: Number(r.overdueTasks) || 0,
    dueToday: Number(r.dueToday) || 0,
    dueThisWeek: Number(r.dueThisWeek) || 0,
    highPriorityOpen: Number(r.highPriorityOpen) || 0,
    finishedLastWeek: Number(r.finishedLastWeek) || 0,
    completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 1000) / 10 : 0,
    activeTasks,
    inProgressRate: activeTasks > 0 ? Math.round(((Number(r.workInProgress) || 0) / activeTasks) * 1000) / 10 : 0
  };
}

function addCalendarDaysToYmd(ymd, days) {
  const m = String(ymd ?? "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function monthLabelFromYmd(ymd) {
  const m = String(ymd).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(dt);
}

/**
 * Build a month calendar grid (Sun–Sat) with open-task due counts per day.
 * @param {string} todayYmd YYYY-MM-DD (IST)
 * @param {Record<string, number>} countByDate
 */
export function buildDueCalendarGrid(todayYmd, countByDate = {}) {
  const m = String(todayYmd).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    return { monthLabel: "", year: 0, month: 0, today: todayYmd, weekdays: ["S", "M", "T", "W", "T", "F", "S"], cells: [], summary: {} };
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const firstOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
  const firstUtc = new Date(Date.UTC(year, month - 1, 1));
  const startPad = firstUtc.getUTCDay();
  const gridStart = addCalendarDaysToYmd(firstOfMonth, -startPad);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const dateStr = addCalendarDaysToYmd(gridStart, i);
    const parts = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const cellMonth = Number(parts[2]);
    const day = Number(parts[3]);
    const inMonth = cellMonth === month;
    const count = Number(countByDate[dateStr]) || 0;
    const isToday = dateStr === todayYmd;
    let tone = "none";
    if (count > 0) {
      if (dateStr < todayYmd) tone = "overdue";
      else if (isToday) tone = "today";
      else tone = "upcoming";
    }
    cells.push({ date: dateStr, day, inMonth, count, tone, isToday });
  }

  while (cells.length > 28 && cells.slice(-7).every((c) => !c.inMonth && c.count === 0)) {
    cells.splice(-7, 7);
  }

  let dueInMonth = 0;
  let overdueInMonth = 0;
  let upcomingInMonth = 0;
  for (const cell of cells) {
    if (!cell.inMonth || !cell.count) continue;
    dueInMonth += cell.count;
    if (cell.tone === "overdue") overdueInMonth += cell.count;
    else if (cell.tone === "upcoming" || cell.tone === "today") upcomingInMonth += cell.count;
  }

  return {
    monthLabel: monthLabelFromYmd(firstOfMonth),
    year,
    month,
    today: todayYmd,
    weekdays: ["S", "M", "T", "W", "T", "F", "S"],
    cells,
    summary: {
      dueInMonth,
      overdueInMonth,
      daysInMonth: lastDay
    }
  };
}

async function queryTaskDueCalendar(user, bucket) {
  const todayYmd = getYmdISTFromInstant(new Date());
  const skeleton = buildDueCalendarGrid(todayYmd, {});
  const gridStart = skeleton.cells[0]?.date;
  const gridEnd = skeleton.cells[skeleton.cells.length - 1]?.date;
  if (!gridStart || !gridEnd) {
    return { ...skeleton, upcomingDays: [], noDueDateCount: 0 };
  }

  const t = tableRef();
  const whereParts = [];
  const whereValues = [];
  appendBucketFilter(bucket, user, whereParts, whereValues);
  const statusCol = mysql.escapeId("status");
  const dueCol = mysql.escapeId("dueDate");
  whereParts.push(`${statusCol} NOT IN ('Completed', 'Cancelled')`);

  const rangeParts = [...whereParts, `${dueCol} IS NOT NULL`, `DATE(${dueCol}) >= ?`, `DATE(${dueCol}) <= ?`];
  const rangeValues = [...whereValues, gridStart, gridEnd];

  const [dueRows] = await pool.query(
    `SELECT DATE(${dueCol}) AS dueDay, COUNT(*) AS cnt
     FROM ${t}
     WHERE ${rangeParts.join(" AND ")}
     GROUP BY DATE(${dueCol})`,
    rangeValues
  );

  const countByDate = {};
  for (const r of dueRows || []) {
    const key = String(r.dueDay ?? "").slice(0, 10);
    if (key) countByDate[key] = Number(r.cnt) || 0;
  }

  const noDueParts = [...whereParts, `${dueCol} IS NULL`];
  const [noDueRows] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM ${t} WHERE ${noDueParts.join(" AND ")}`,
    whereValues
  );
  const noDueDateCount = Number(noDueRows?.[0]?.cnt) || 0;

  const calendar = buildDueCalendarGrid(todayYmd, countByDate);

  const upcomingDays = calendar.cells
    .filter((c) => c.inMonth && c.count > 0 && c.date >= todayYmd)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4)
    .map((c) => ({ date: c.date, count: c.count, tone: c.tone }));

  return { ...calendar, upcomingDays, noDueDateCount };
}

/**
 * Dashboard runner summary for landing widget.
 */
export async function loadTaskDashboardSummary(user) {
  const [
    assignedToMeCounts,
    assignedByMeCounts,
    assignedToMeMetrics,
    assignedByMeMetrics,
    assignedToMeCalendar
  ] = await Promise.all([
    queryStatusCounts(user, "assigned_to_me"),
    queryStatusCounts(user, "assigned_by_me"),
    queryTaskMetrics(user, "assigned_to_me"),
    queryTaskMetrics(user, "assigned_by_me"),
    queryTaskDueCalendar(user, "assigned_to_me")
  ]);
  return {
    assignedToMe: {
      ...assignedToMeCounts,
      openCount: countOpenTasks(assignedToMeCounts.statusCounts),
      metrics: assignedToMeMetrics,
      calendar: assignedToMeCalendar
    },
    assignedByMe: {
      ...assignedByMeCounts,
      openCount: countOpenTasks(assignedByMeCounts.statusCounts),
      metrics: assignedByMeMetrics
    }
  };
}

async function enrichRowsWithUserLabels(rows) {
  if (!rows?.length) return rows || [];
  const ids = new Set();
  for (const r of rows) {
    if (r.assignee) ids.add(Number(r.assignee));
    if (r.createdBy) ids.add(Number(r.createdBy));
    if (r.followUpPerson) ids.add(Number(r.followUpPerson));
  }
  if (!ids.size) return rows;
  const usersTable = escapeSqlTableIdForModuleConfig(modules.users);
  const idList = [...ids];
  const placeholders = idList.map(() => "?").join(", ");
  const [users] = await pool.query(
    `SELECT id, fullName FROM ${usersTable} WHERE id IN (${placeholders})`,
    idList
  );
  const byId = Object.fromEntries((users || []).map((u) => [Number(u.id), u.fullName || ""]));
  return rows.map((r) => ({
    ...r,
    assigneeLabel: byId[Number(r.assignee)] || "",
    createdByLabel: byId[Number(r.createdBy)] || "",
    followUpPersonLabel: byId[Number(r.followUpPerson)] || ""
  }));
}

export async function listTasksForDashboard(user, { bucket, status } = {}) {
  const b = normalizeBucket(bucket);
  const t = tableRef();
  const whereParts = [];
  const whereValues = [];
  appendBucketFilter(b, user, whereParts, whereValues);

  const st = String(status ?? "").trim();
  if (st && TASK_STATUSES.includes(st)) {
    whereParts.push(`${mysql.escapeId("status")} = ?`);
    whereValues.push(st);
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
  const dueDateCol = mysql.escapeId("dueDate");
  const idCol = mysql.escapeId("id");
  const orderSql =
    st && TASK_STATUSES.includes(st)
      ? `ORDER BY ${dueDateCol} IS NULL, ${dueDateCol} ASC, ${idCol} DESC`
      : `ORDER BY ${idCol} DESC`;
  const [rows] = await pool.query(
    `SELECT id, taskTitle, description, assignee, followUpPerson, dueDate, priority, status, createdBy, createdDate, modifiedBy, modifiedDate
     FROM ${t} ${whereSql}
     ${orderSql}`,
    whereValues
  );
  return enrichRowsWithUserLabels(rows || []);
}

export async function getStatusCountsForBucket(user, bucket) {
  return queryStatusCounts(user, normalizeBucket(bucket));
}

async function loadTaskRowById(id) {
  const t = tableRef();
  const [rows] = await pool.query(`SELECT * FROM ${t} WHERE id = ? LIMIT 1`, [id]);
  return rows?.[0] || null;
}

function userCanViewTask(user, row) {
  if (!row) return false;
  if (isAdmin(user)) return true;
  const uid = asPositiveInt(user?.id);
  if (!uid) return false;
  if (Number(row.assignee) === uid) return true;
  if (Number(row.followUpPerson) === uid) return true;
  if (Number(row.createdBy) === uid && Number(row.assignee) !== uid) return true;
  return false;
}

const DETAIL_FIELDS = ["taskTitle", "description", "dueDate", "priority", "followUpPerson"];
const ADMIN_DETAIL_FIELDS = [...DETAIL_FIELDS, "assignee"];

function userCanEditTaskDetails(user, row) {
  if (!row) return false;
  if (isAdmin(user)) return true;
  const uid = asPositiveInt(user?.id);
  return uid != null && Number(row.createdBy) === uid;
}

function userCanUpdateTaskStatus(user, row) {
  if (!row) return false;
  if (isAdmin(user)) return true;
  const uid = asPositiveInt(user?.id);
  return uid != null && Number(row.assignee) === uid;
}

function userCanCommentOnTask(user, row) {
  if (!row) return false;
  if (isAdmin(user)) return true;
  const uid = asPositiveInt(user?.id);
  if (!uid) return false;
  return (
    Number(row.createdBy) === uid ||
    Number(row.assignee) === uid ||
    Number(row.followUpPerson) === uid
  );
}

function patchHasDetailFields(patch) {
  return DETAIL_FIELDS.some((k) => patch[k] !== undefined);
}

function patchHasStatusChange(patch, oldStatus) {
  if (patch.status == null || String(patch.status).trim() === "") return false;
  return String(patch.status).trim() !== String(oldStatus ?? "").trim();
}

function taskPermissionsForUser(user, row) {
  const uid = asPositiveInt(user?.id);
  const isCompleted = String(row?.status ?? "").trim() === "Completed";
  const isCreator = userCanEditTaskDetails(user, row);
  const isFollowUpOnly =
    uid != null &&
    Number(row.followUpPerson) === uid &&
    Number(row.assignee) !== uid &&
    Number(row.createdBy) !== uid &&
    !isAdmin(user);

  if (isCompleted && !isCreator && !isAdmin(user)) {
    return {
      canEditDetails: false,
      canUpdateStatus: false,
      canComment: false,
      isFollowUpOnly,
      isCompletedLocked: true
    };
  }

  if (isCompleted && isCreator) {
    return {
      canEditDetails: true,
      canUpdateStatus: true,
      canComment: true,
      isFollowUpOnly: false,
      isCompletedLocked: false
    };
  }

  return {
    canEditDetails: userCanEditTaskDetails(user, row),
    canUpdateStatus: userCanUpdateTaskStatus(user, row),
    canComment: userCanCommentOnTask(user, row),
    isFollowUpOnly,
    isCompletedLocked: false
  };
}

export async function getTaskDetailForDashboard(user, id) {
  const row = await loadTaskRowById(id);
  if (!row) return { status: 404, body: { error: "Task not found" } };
  if (!userCanViewTask(user, row)) {
    return { status: 403, body: { error: "Forbidden" } };
  }

  const childTableRows = await loadChildTableRowsForParent(moduleConfig(), Number(id));
  const usersTable = escapeSqlTableIdForModuleConfig(modules.users);
  let assigneeLabel = "";
  let createdByLabel = "";
  let followUpPersonLabel = "";
  if (row.assignee) {
    const [u] = await pool.query(`SELECT fullName FROM ${usersTable} WHERE id = ? LIMIT 1`, [row.assignee]);
    assigneeLabel = u?.[0]?.fullName || "";
  }
  if (row.createdBy) {
    const [u] = await pool.query(`SELECT fullName FROM ${usersTable} WHERE id = ? LIMIT 1`, [row.createdBy]);
    createdByLabel = u?.[0]?.fullName || "";
  }
  if (row.followUpPerson) {
    const [u] = await pool.query(`SELECT fullName FROM ${usersTable} WHERE id = ? LIMIT 1`, [row.followUpPerson]);
    followUpPersonLabel = u?.[0]?.fullName || "";
  }

  const userIds = new Set();
  for (const h of childTableRows?.activity_log || []) {
    if (h.changedBy) userIds.add(Number(h.changedBy));
    if (h.fieldName === "followUpPerson") {
      if (h.fromValue) userIds.add(Number(h.fromValue));
      if (h.toValue) userIds.add(Number(h.toValue));
    }
  }
  for (const c of childTableRows?.comments || []) {
    if (c.commentedBy) userIds.add(Number(c.commentedBy));
  }
  let nameById = {};
  if (userIds.size) {
    const idList = [...userIds];
    const placeholders = idList.map(() => "?").join(", ");
    const [users] = await pool.query(
      `SELECT id, fullName FROM ${usersTable} WHERE id IN (${placeholders})`,
      idList
    );
    nameById = Object.fromEntries((users || []).map((u) => [Number(u.id), u.fullName || ""]));
  }

  const activity_log = (childTableRows?.activity_log || []).map((h) => ({
    ...h,
    changedByLabel: nameById[Number(h.changedBy)] || ""
  }));
  const comments = (childTableRows?.comments || []).map((c) => ({
    ...c,
    commentedByLabel: nameById[Number(c.commentedBy)] || ""
  }));

  return {
    status: 200,
    body: {
      data: {
        ...row,
        assigneeLabel,
        createdByLabel,
        followUpPersonLabel,
        permissions: taskPermissionsForUser(user, row)
      },
      childTableRows: {
        ...childTableRows,
        activity_log,
        comments
      }
    }
  };
}

export async function createTaskFromDashboard(user, body) {
  const cfg = moduleConfig();
  const raw = normalizeCrudPayload(stripClientAuditFields(body || {}), cfg);
  const allowedFields = getWritableFieldNames(cfg);
  const insertKeys = Object.keys(raw).filter((key) => allowedFields.includes(key));
  if (!insertKeys.length) {
    return { status: 400, body: { error: "No valid fields to insert" } };
  }
  const validationSlice = Object.fromEntries(insertKeys.map((k) => [k, raw[k]]));
  const err = validateCrudPayloadForWrite(cfg, validationSlice, "create", insertKeys);
  if (err) return { status: 400, body: { error: err } };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    let merged = { ...validationSlice };
    if (!merged.status) merged.status = "Pending";
    if (!merged.priority) merged.priority = "Medium";
    await applyTaskBeforeWrite(conn, { user, merged, childTableRows: null });
    merged = applyCreateAudit(merged, user.id, {
      createdBy: "createdBy",
      createdAt: "createdDate",
      modifiedBy: "modifiedBy",
      modifiedAt: "modifiedDate"
    });

    const cols = Object.keys(merged).filter((k) => merged[k] !== undefined);
    const t = tableRef();
    const placeholders = cols.map(() => "?").join(", ");
    const [result] = await conn.query(
      `INSERT INTO ${t} (${cols.map((c) => mysql.escapeId(c)).join(", ")}) VALUES (${placeholders})`,
      cols.map((c) => merged[c])
    );
    const insertId = Number(result.insertId);
    await applyTaskAfterCreateWrite(conn, { user, merged, insertId });
    await conn.commit();
    return { status: 201, body: { id: insertId, data: { ...merged, id: insertId } } };
  } catch (e) {
    await conn.rollback();
    if (e?.code === "TASK_VALIDATION_FAILED") {
      return { status: 400, body: { error: e.message } };
    }
    throw e;
  } finally {
    conn.release();
  }
}

export async function updateTaskFromDashboard(user, id, body) {
  const taskId = asPositiveInt(id);
  if (!taskId) return { status: 400, body: { error: "Invalid task id" } };

  const oldRow = await loadTaskRowById(taskId);
  if (!oldRow) return { status: 404, body: { error: "Task not found" } };
  if (!userCanViewTask(user, oldRow)) {
    return { status: 403, body: { error: "Forbidden" } };
  }

  const perms = taskPermissionsForUser(user, oldRow);
  const patch = body && typeof body === "object" ? body : {};
  const commentText = patch.commentText != null ? String(patch.commentText).trim() : "";
  const wantsDetail = patchHasDetailFields(patch) || (isAdmin(user) && patch.assignee !== undefined);
  const wantsStatus = patchHasStatusChange(patch, oldRow.status);
  const wantsComment = Boolean(commentText);

  if (!wantsDetail && !wantsStatus && !wantsComment) {
    return { status: 400, body: { error: "No changes to save." } };
  }

  if (wantsDetail && !perms.canEditDetails) {
    return { status: 403, body: { error: "You cannot edit task details." } };
  }
  if (wantsStatus && !perms.canUpdateStatus) {
    return { status: 403, body: { error: "You cannot change task status." } };
  }
  if (wantsComment && !perms.canComment) {
    return { status: 403, body: { error: "You cannot add comments on this task." } };
  }
  if (!isAdmin(user) && patch.assignee !== undefined) {
    return { status: 403, body: { error: "Assignee cannot be changed after creation." } };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let merged = { ...oldRow };
    const updateCols = new Set(["modifiedBy", "modifiedDate"]);

    if (wantsStatus) {
      const st = String(patch.status).trim();
      if (!TASK_STATUSES.includes(st)) {
        await conn.rollback();
        return { status: 400, body: { error: "Invalid status." } };
      }
      merged.status = st;
      updateCols.add("status");
    }

    if (wantsDetail) {
      const allowed = isAdmin(user) ? ADMIN_DETAIL_FIELDS : DETAIL_FIELDS;
      const updateKeys = [];
      for (const k of allowed) {
        if (patch[k] !== undefined) {
          merged[k] = patch[k];
          updateKeys.push(k);
          updateCols.add(k);
        }
      }
      const err = validateCrudPayloadForWrite(moduleConfig(), merged, "update", updateKeys);
      if (err) {
        await conn.rollback();
        return { status: 400, body: { error: err } };
      }
      await applyTaskBeforeWrite(conn, { user, merged, childTableRows: null, oldRow });
    }

    if (wantsComment) {
      const now = formatInstantAsMysqlDatetimeIST();
      const commentsTable = mysql.escapeId("task_comments");
      await conn.query(
        `INSERT INTO ${commentsTable} (${mysql.escapeId("taskId")}, ${mysql.escapeId("commentText")}, ${mysql.escapeId("commentedBy")}, ${mysql.escapeId("commentedAt")}) VALUES (?, ?, ?, ?)`,
        [taskId, commentText, user.id, now]
      );
    }

    merged = applyUpdateAudit(merged, user.id, {
      createdBy: "createdBy",
      createdAt: "createdDate",
      modifiedBy: "modifiedBy",
      modifiedAt: "modifiedDate"
    });

    const cols = [...updateCols];
    const setParts = cols.map((c) => `${mysql.escapeId(c)} = ?`);
    const values = cols.map((c) => merged[c]);
    values.push(taskId);

    const t = tableRef();
    await conn.query(`UPDATE ${t} SET ${setParts.join(", ")} WHERE id = ?`, values);

    await applyTaskAfterUpdateWrite(conn, {
      user,
      oldRow,
      merged,
      id: taskId
    });

    await conn.commit();
    return getTaskDetailForDashboard(user, taskId);
  } catch (e) {
    await conn.rollback();
    if (e?.code === "TASK_VALIDATION_FAILED") {
      return { status: 400, body: { error: e.message } };
    }
    throw e;
  } finally {
    conn.release();
  }
}

export {
  userCanEditTaskDetails,
  userCanUpdateTaskStatus,
  userCanCommentOnTask,
  userCanViewTask,
  normalizeBucket,
  taskPermissionsForUser,
  appendBucketFilter
};
