"use client";

/**
 * React UI component: ReminderActivityList
 * Timeline of field changes (status, due date, recurrence, spawned) on a reminder.
 * Keep module-specific business rules in lib/modules/*Client.js, not here.
 */

import { formatReminderDate, formatReminderDateTime } from "./reminderUtils";

const FIELD_LABELS = {
  status: "status",
  dueDate: "due date",
  recurrenceType: "recurrence",
  spawned: "next reminder"
};

function formatActivityValue(fieldName, value) {
  if (value == null || value === "") return "—";
  if (fieldName === "dueDate") {
    const s = String(value).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? formatReminderDate(s) : String(value);
  }
  if (fieldName === "spawned") return `Reminder #${value}`;
  return String(value);
}

function activityMessage(row) {
  const name = row.changedByLabel || "User";
  const field = FIELD_LABELS[row.fieldName] || row.fieldName || "field";
  const from = formatActivityValue(row.fieldName, row.fromValue);
  const to = formatActivityValue(row.fieldName, row.toValue);

  if (row.fieldName === "status" && (row.fromValue == null || row.fromValue === "")) {
    return (
      <>
        <strong>{name}</strong> set {field} to <strong>{to}</strong>
      </>
    );
  }

  if (row.fieldName === "spawned") {
    return (
      <>
        <strong>{name}</strong> created {field} <strong>{to}</strong>
      </>
    );
  }

  if (from === "—") {
    return (
      <>
        <strong>{name}</strong> set {field} to <strong>{to}</strong>
      </>
    );
  }

  return (
    <>
      <strong>{name}</strong> changed {field} from <strong>{from}</strong> to <strong>{to}</strong>
    </>
  );
}

/**
 * Vertical timeline of reminder activity rows.
 * @param {{ rows?: object[] }} props
 */
export default function ReminderActivityList({ rows }) {
  const list = rows || [];
  if (!list.length) {
    return <p className="reminder-empty-inline">No changes recorded yet.</p>;
  }
  return (
    <ul className="reminder-timeline">
      {list.map((r, i) => {
        const isLast = i === list.length - 1;
        return (
          <li key={r.id} className={`reminder-timeline-item${isLast ? " is-last" : ""}`}>
            <span className="reminder-timeline-dot" aria-hidden="true" />
            <div className="reminder-timeline-content">
              <p className="reminder-timeline-text">{activityMessage(r)}</p>
              <time className="reminder-timeline-time">
                {r.changedAt ? formatReminderDateTime(r.changedAt) : ""}
              </time>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
