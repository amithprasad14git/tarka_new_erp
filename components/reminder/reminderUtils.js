/** Shared helpers for reminder UI components. */

export const REMINDER_STATUSES = ["Pending", "Completed", "Cancelled"];
export const VIEW_ALL_STATUS = "All";

export const RECURRENCE_TYPES = ["None", "Daily", "Weekly", "Monthly", "Yearly"];

export const REMINDER_STATUS_COLORS = {
  Pending: "#64748b",
  Completed: "#16a34a",
  Cancelled: "#dc2626"
};

export function formatReminderDate(value) {
  if (!value) return "";
  const s = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return String(value);
  const d = new Date(`${s}T12:00:00`);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatReminderDateTime(value) {
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

export function overdueDaysSeverity(days) {
  if (days == null || days <= 0) return "none";
  if (days <= 3) return "mild";
  if (days <= 7) return "moderate";
  return "severe";
}

export function sortRemindersForListView(reminders, activeStatus) {
  const list = [...(reminders || [])];
  if (activeStatus === VIEW_ALL_STATUS) {
    return list.sort((a, b) => Number(b.id) - Number(a.id));
  }
  return list.sort((a, b) => {
    const aDue = a.dueDate ? String(a.dueDate).slice(0, 10) : null;
    const bDue = b.dueDate ? String(b.dueDate).slice(0, 10) : null;
    if (!aDue && !bDue) return Number(b.id) - Number(a.id);
    if (!aDue) return 1;
    if (!bDue) return -1;
    if (aDue !== bDue) return aDue.localeCompare(bDue);
    return Number(b.id) - Number(a.id);
  });
}

export function formatLocalDateInput(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function minDueDateToday() {
  return formatLocalDateInput(new Date());
}

export function isDueDateOnOrAfterToday(dueDate) {
  if (!dueDate) return true;
  const s = String(dueDate).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return s >= formatLocalDateInput(new Date());
}

export function recurrenceLabel(type) {
  const t = String(type || "None").trim();
  if (t === "None") return "";
  return t;
}
