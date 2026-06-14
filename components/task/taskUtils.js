/** Shared helpers for task UI components. */

export const TASK_STATUSES = ["Pending", "In Progress", "Completed", "Cancelled"];

/** Opens the list modal without a status filter. */
export const VIEW_ALL_STATUS = "All";

export const TASK_STATUS_COLORS = {
  Pending: "#64748b",
  "In Progress": "#2563eb",
  Completed: "#16a34a",
  Cancelled: "#dc2626"
};

export const STATUS_TILE_CLASS = {
  Pending: "task-stat-tile--pending",
  "In Progress": "task-stat-tile--progress",
  Completed: "task-stat-tile--completed",
  Cancelled: "task-stat-tile--cancelled"
};

export const PRIORITY_ACCENT_CLASS = {
  Low: "task-row-accent--low",
  Medium: "task-row-accent--medium",
  High: "task-row-accent--high"
};

export function initialsFromName(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatTaskDate(value) {
  if (!value) return "";
  const s = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return String(value);
  const d = new Date(`${s}T12:00:00`);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** Datetime for activity/comments — DD-MM-YYYY HH:MM */
export function formatTaskDateTime(value) {
  if (!value) return "";
  const raw = String(value).trim();
  const isoLike = raw.replace(" ", "T");
  const d = new Date(isoLike);
  if (!Number.isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
  }
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]} ${m[4]}:${m[5]}`;
  return raw;
}

export function isDueOverdue(dueDate, status) {
  if (!dueDate) return false;
  if (status === "Completed" || status === "Cancelled") return false;
  const s = String(dueDate).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  return s < `${y}-${m}-${d}`;
}

export function truncateText(text, max = 80) {
  const t = String(text || "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function formatTableDate(value) {
  if (!value) return "—";
  const raw = String(value).trim();
  const datePart = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const d = new Date(`${datePart}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
    }
  }
  if (raw.length >= 10) return raw.slice(0, 10);
  return raw || "—";
}

export function daysPastDue(dueDate, status) {
  if (!dueDate) return null;
  if (status === "Completed" || status === "Cancelled") return null;
  const s = String(dueDate).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const due = new Date(`${s}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const diffMs = today.getTime() - due.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

/** Severity tier for overdue day count (color coding in grouped task list). */
export function overdueDaysSeverity(days) {
  if (days == null || days <= 0) return "none";
  if (days <= 3) return "mild";
  if (days <= 7) return "moderate";
  return "severe";
}

export function bucketSubtitle(bucket, count) {
  const n = Number(count) || 0;
  const word = n === 1 ? "task" : "tasks";
  if (bucket === "assigned_by_me") {
    return `${n} ${word} you assigned to others`;
  }
  return `${n} ${word} assigned to you`;
}

function dueDateSortKey(dueDate) {
  if (!dueDate) return null;
  return String(dueDate).slice(0, 10);
}

/** All → newest id first; specific status → earliest due date first (no due date last). */
export function sortTasksForListView(tasks, activeStatus) {
  const list = [...(tasks || [])];
  if (activeStatus === VIEW_ALL_STATUS) {
    return list.sort((a, b) => Number(b.id) - Number(a.id));
  }
  return list.sort((a, b) => {
    const aDue = dueDateSortKey(a.dueDate);
    const bDue = dueDateSortKey(b.dueDate);
    if (!aDue && !bDue) return Number(b.id) - Number(a.id);
    if (!aDue) return 1;
    if (!bDue) return -1;
    if (aDue !== bDue) return aDue.localeCompare(bDue);
    return Number(b.id) - Number(a.id);
  });
}

/** Local calendar date YYYY-MM-DD for date inputs. */
export function formatLocalDateInput(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Minimum due date for tasks: today (local). */
export function minDueDateToday() {
  return formatLocalDateInput(new Date());
}

/** @deprecated use minDueDateToday */
export function minDueDateTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatLocalDateInput(d);
}

export function isDueDateOnOrAfterToday(dueDate) {
  if (!dueDate) return true;
  const s = String(dueDate).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return s >= formatLocalDateInput(new Date());
}

/** @deprecated use isDueDateOnOrAfterToday */
export function isDueDateAfterToday(dueDate) {
  return isDueDateOnOrAfterToday(dueDate) && String(dueDate).slice(0, 10) !== formatLocalDateInput(new Date());
}
