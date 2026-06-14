/**
 * Reminder dashboard service — list/create/update for My Reminders widget (/api/reminder).
 * Uses config/modules.js reminder_master; gated by dashboard_my_reminders permission.
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
  REMINDER_STATUSES,
  applyReminderBeforeWrite,
  applyReminderAfterCreateWrite,
  applyReminderAfterUpdateWrite,
  spawnNextOccurrence
} from "./reminder";
import { formatInstantAsMysqlDatetimeIST, getYmdISTFromInstant } from "../istDateTime";

export { REMINDER_STATUSES };

const CLOSED_STATUSES = new Set(["Completed", "Cancelled"]);

function moduleConfig() {
  return modules.reminder_master;
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

function getWritableFieldNames(cfg) {
  return (cfg.fields || []).filter((f) => !f.excludeFromForm).map((f) => f.name);
}

function appendReminderOwnerFilter(user, whereParts, whereValues) {
  if (isAdmin(user)) return;
  const uid = asPositiveInt(user?.id);
  if (!uid) {
    whereParts.push("1=0");
    return;
  }
  whereParts.push(`${mysql.escapeId("createdBy")} = ?`);
  whereValues.push(uid);
}

function emptyStatusCounts() {
  const o = {};
  for (const s of REMINDER_STATUSES) o[s] = 0;
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

function countOpenReminders(statusCounts) {
  let n = 0;
  for (const [st, cnt] of Object.entries(statusCounts || {})) {
    if (!CLOSED_STATUSES.has(st)) n += Number(cnt) || 0;
  }
  return n;
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
  for (const cell of cells) {
    if (!cell.inMonth || !cell.count) continue;
    dueInMonth += cell.count;
    if (cell.tone === "overdue") overdueInMonth += cell.count;
  }

  return {
    monthLabel: monthLabelFromYmd(firstOfMonth),
    year,
    month,
    today: todayYmd,
    weekdays: ["S", "M", "T", "W", "T", "F", "S"],
    cells,
    summary: { dueInMonth, overdueInMonth, daysInMonth: lastDay }
  };
}

async function queryStatusCounts(user) {
  const t = tableRef();
  const whereParts = [];
  const whereValues = [];
  appendReminderOwnerFilter(user, whereParts, whereValues);
  const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
  const [rows] = await pool.query(
    `SELECT ${mysql.escapeId("status")} AS status, COUNT(*) AS cnt FROM ${t} ${whereSql} GROUP BY ${mysql.escapeId("status")}`,
    whereValues
  );
  const statusCounts = rowsToStatusCounts(rows);
  return { statusCounts, total: Object.values(statusCounts).reduce((a, b) => a + b, 0) };
}

async function queryReminderMetrics(user) {
  const t = tableRef();
  const whereParts = [];
  const whereValues = [];
  appendReminderOwnerFilter(user, whereParts, whereValues);
  const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
  const statusCol = mysql.escapeId("status");
  const dueCol = mysql.escapeId("dueDate");
  const openFilter = `${statusCol} NOT IN ('Completed', 'Cancelled')`;
  const [rows] = await pool.query(
    `SELECT
      COUNT(*) AS totalReminders,
      SUM(CASE WHEN ${statusCol} = 'Completed' THEN 1 ELSE 0 END) AS completedReminders,
      SUM(CASE WHEN ${statusCol} = 'Pending' THEN 1 ELSE 0 END) AS pendingReminders,
      SUM(CASE WHEN ${statusCol} = 'Cancelled' THEN 1 ELSE 0 END) AS cancelledReminders,
      SUM(CASE WHEN ${openFilter}
        AND ${dueCol} IS NOT NULL AND DATE(${dueCol}) < CURDATE() THEN 1 ELSE 0 END) AS overdueReminders,
      SUM(CASE WHEN ${openFilter}
        AND ${dueCol} IS NOT NULL AND DATE(${dueCol}) = CURDATE() THEN 1 ELSE 0 END) AS dueToday,
      SUM(CASE WHEN ${openFilter}
        AND ${dueCol} IS NOT NULL
        AND DATE(${dueCol}) > CURDATE()
        AND DATE(${dueCol}) <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS dueThisWeek
    FROM ${t} ${whereSql}`,
    whereValues
  );
  const r = rows?.[0] || {};
  return {
    totalReminders: Number(r.totalReminders) || 0,
    completedReminders: Number(r.completedReminders) || 0,
    pendingReminders: Number(r.pendingReminders) || 0,
    cancelledReminders: Number(r.cancelledReminders) || 0,
    overdueReminders: Number(r.overdueReminders) || 0,
    dueToday: Number(r.dueToday) || 0,
    dueThisWeek: Number(r.dueThisWeek) || 0
  };
}

async function queryReminderDueCalendar(user) {
  const todayYmd = getYmdISTFromInstant(new Date());
  const skeleton = buildDueCalendarGrid(todayYmd, {});
  const gridStart = skeleton.cells[0]?.date;
  const gridEnd = skeleton.cells[skeleton.cells.length - 1]?.date;
  if (!gridStart || !gridEnd) {
    return { ...skeleton, noDueDateCount: 0 };
  }

  const t = tableRef();
  const whereParts = [];
  const whereValues = [];
  appendReminderOwnerFilter(user, whereParts, whereValues);
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
  return { ...calendar, noDueDateCount };
}

export async function loadReminderDashboardSummary(user) {
  const [counts, metrics, calendar] = await Promise.all([
    queryStatusCounts(user),
    queryReminderMetrics(user),
    queryReminderDueCalendar(user)
  ]);

  return {
    statusCounts: counts.statusCounts,
    total: counts.total,
    openCount: countOpenReminders(counts.statusCounts),
    metrics,
    calendar
  };
}

async function enrichRowsWithUserLabels(rows) {
  if (!rows?.length) return rows || [];
  const ids = new Set();
  for (const r of rows) {
    if (r.createdBy) ids.add(Number(r.createdBy));
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
    createdByLabel: byId[Number(r.createdBy)] || ""
  }));
}

export async function listRemindersForDashboard(user, { status, dueDate } = {}) {
  const t = tableRef();
  const whereParts = [];
  const whereValues = [];
  appendReminderOwnerFilter(user, whereParts, whereValues);

  const st = String(status ?? "").trim();
  if (st && REMINDER_STATUSES.includes(st)) {
    whereParts.push(`${mysql.escapeId("status")} = ?`);
    whereValues.push(st);
  }

  const due = String(dueDate ?? "").trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(due)) {
    whereParts.push(`DATE(${mysql.escapeId("dueDate")}) = ?`);
    whereValues.push(due);
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";
  const dueDateCol = mysql.escapeId("dueDate");
  const idCol = mysql.escapeId("id");
  const [rows] = await pool.query(
    `SELECT id, reminderTitle, notes, dueDate, recurrenceType, status,
            seriesRootId, spawnedFromId, createdBy, createdDate, modifiedBy, modifiedDate
     FROM ${t} ${whereSql}
     ORDER BY ${dueDateCol} IS NULL, ${dueDateCol} ASC, ${idCol} DESC`,
    whereValues
  );
  return enrichRowsWithUserLabels(rows || []);
}

export async function getStatusCountsForUser(user) {
  return queryStatusCounts(user);
}

async function loadReminderRowById(id) {
  const t = tableRef();
  const [rows] = await pool.query(`SELECT * FROM ${t} WHERE id = ? LIMIT 1`, [id]);
  return rows?.[0] || null;
}

function userCanViewReminder(user, row) {
  if (!row) return false;
  if (isAdmin(user)) return true;
  const uid = asPositiveInt(user?.id);
  return uid != null && Number(row.createdBy) === uid;
}

function userCanEditReminder(user, row) {
  if (!row) return false;
  if (isAdmin(user)) return true;
  const uid = asPositiveInt(user?.id);
  return uid != null && Number(row.createdBy) === uid;
}

const DETAIL_FIELDS = ["reminderTitle", "notes", "dueDate", "recurrenceType"];

const UPDATABLE_COLUMNS = new Set([
  "reminderTitle",
  "notes",
  "dueDate",
  "recurrenceType",
  "status",
  "modifiedBy",
  "modifiedDate"
]);

const DEPRECATED_COLUMNS = ["snoozedUntil"];

function stripDeprecatedFields(row) {
  if (!row || typeof row !== "object") return row;
  for (const key of DEPRECATED_COLUMNS) {
    delete row[key];
  }
  return row;
}

function reminderPermissionsForUser(user, row) {
  const canEdit = userCanEditReminder(user, row);
  return {
    canEditDetails: canEdit,
    canUpdateStatus: canEdit,
    isOwner: Number(row?.createdBy) === asPositiveInt(user?.id),
    isAdmin: isAdmin(user)
  };
}

function patchHasDetailFields(patch) {
  return DETAIL_FIELDS.some((k) => patch[k] !== undefined);
}

function patchHasStatusChange(patch, oldStatus) {
  if (patch.status == null || String(patch.status).trim() === "") return false;
  return String(patch.status).trim() !== String(oldStatus ?? "").trim();
}

export async function getReminderDetailForDashboard(user, id) {
  const row = await loadReminderRowById(id);
  if (!row) return { status: 404, body: { error: "Reminder not found" } };
  if (!userCanViewReminder(user, row)) {
    return { status: 403, body: { error: "Forbidden" } };
  }

  const childTableRows = await loadChildTableRowsForParent(moduleConfig(), Number(id));
  const usersTable = escapeSqlTableIdForModuleConfig(modules.users);
  let createdByLabel = "";
  if (row.createdBy) {
    const [u] = await pool.query(`SELECT fullName FROM ${usersTable} WHERE id = ? LIMIT 1`, [row.createdBy]);
    createdByLabel = u?.[0]?.fullName || "";
  }

  const userIds = new Set();
  for (const h of childTableRows?.activity_log || []) {
    if (h.changedBy) userIds.add(Number(h.changedBy));
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

  return {
    status: 200,
    body: {
      data: {
        ...row,
        createdByLabel,
        permissions: reminderPermissionsForUser(user, row)
      },
      childTableRows: { ...childTableRows, activity_log }
    }
  };
}

export async function createReminderFromDashboard(user, body) {
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
    if (!merged.recurrenceType) merged.recurrenceType = "None";
    await applyReminderBeforeWrite(conn, { user, merged, childTableRows: null });
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
    await applyReminderAfterCreateWrite(conn, { user, merged, insertId });
    await conn.commit();
    return { status: 201, body: { id: insertId, data: { ...merged, id: insertId } } };
  } catch (e) {
    await conn.rollback();
    if (e?.code === "REMINDER_VALIDATION_FAILED") {
      return { status: 400, body: { error: e.message } };
    }
    throw e;
  } finally {
    conn.release();
  }
}

export async function updateReminderFromDashboard(user, id, body) {
  const reminderId = asPositiveInt(id);
  if (!reminderId) return { status: 400, body: { error: "Invalid reminder id" } };

  const oldRow = await loadReminderRowById(reminderId);
  if (!oldRow) return { status: 404, body: { error: "Reminder not found" } };
  if (!userCanViewReminder(user, oldRow)) {
    return { status: 403, body: { error: "Forbidden" } };
  }

  const perms = reminderPermissionsForUser(user, oldRow);
  const patch = body && typeof body === "object" ? body : {};
  const wantsDetail = patchHasDetailFields(patch);
  const wantsStatus = patchHasStatusChange(patch, oldRow.status);

  if (!wantsDetail && !wantsStatus) {
    return { status: 400, body: { error: "No changes to save." } };
  }

  if ((wantsDetail || wantsStatus) && !perms.canEditDetails) {
    return { status: 403, body: { error: "You cannot edit this reminder." } };
  }

  const conn = await pool.getConnection();
  let spawnedReminder = null;
  try {
    await conn.beginTransaction();

    let merged = stripDeprecatedFields({ ...oldRow });
    const updateCols = new Set(["modifiedBy", "modifiedDate"]);

    if (wantsStatus) {
      const st = String(patch.status).trim();
      if (!REMINDER_STATUSES.includes(st)) {
        await conn.rollback();
        return { status: 400, body: { error: "Invalid status." } };
      }
      merged.status = st;
      updateCols.add("status");
    }

    if (wantsDetail) {
      for (const k of DETAIL_FIELDS) {
        if (patch[k] !== undefined) {
          merged[k] = patch[k];
          updateCols.add(k);
        }
      }
      const err = validateCrudPayloadForWrite(moduleConfig(), merged, "update", [...updateCols].filter((c) => DETAIL_FIELDS.includes(c)));
      if (err) {
        await conn.rollback();
        return { status: 400, body: { error: err } };
      }
    }

    await applyReminderBeforeWrite(conn, { user, merged, childTableRows: null, oldRow });

    merged = applyUpdateAudit(merged, user.id, {
      createdBy: "createdBy",
      createdAt: "createdDate",
      modifiedBy: "modifiedBy",
      modifiedAt: "modifiedDate"
    });

    const cols = [...updateCols].filter((c) => UPDATABLE_COLUMNS.has(c));
    const setParts = cols.map((c) => `${mysql.escapeId(c)} = ?`);
    const values = cols.map((c) => merged[c]);
    values.push(reminderId);

    const t = tableRef();
    await conn.query(`UPDATE ${t} SET ${setParts.join(", ")} WHERE id = ?`, values);

    await applyReminderAfterUpdateWrite(conn, { user, oldRow, merged, id: reminderId });

    if (wantsStatus && merged.status === "Completed") {
      spawnedReminder = await spawnNextOccurrence(conn, { completedRow: merged, user });
    }

    await conn.commit();

    const detail = await getReminderDetailForDashboard(user, reminderId);
    if (spawnedReminder) {
      detail.body.spawnedReminder = {
        id: spawnedReminder.id,
        reminderTitle: spawnedReminder.reminderTitle,
        dueDate: spawnedReminder.dueDate,
        recurrenceType: spawnedReminder.recurrenceType
      };
    }
    return detail;
  } catch (e) {
    await conn.rollback();
    if (e?.code === "REMINDER_VALIDATION_FAILED") {
      return { status: 400, body: { error: e.message } };
    }
    throw e;
  } finally {
    conn.release();
  }
}

export {
  userCanViewReminder,
  userCanEditReminder,
  reminderPermissionsForUser,
  appendReminderOwnerFilter
};
