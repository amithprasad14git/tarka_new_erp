"use client";

import { formatTaskDate, formatTaskDateTime } from "./taskUtils";

const FIELD_LABELS = {
  status: "status",
  dueDate: "due date",
  priority: "priority",
  followUpPerson: "follow-up person"
};

function formatActivityValue(fieldName, value, userNamesById) {
  if (value == null || value === "") return "—";
  if (fieldName === "dueDate") {
    const s = String(value).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? formatTaskDate(s) : String(value);
  }
  if (fieldName === "followUpPerson") {
    const id = Number(value);
    if (Number.isFinite(id) && userNamesById[id]) return userNamesById[id];
    return value ? String(value) : "—";
  }
  return String(value);
}

function activityMessage(row, userNamesById) {
  const name = row.changedByLabel || userNamesById[row.changedBy] || "User";
  const field = FIELD_LABELS[row.fieldName] || row.fieldName || "field";
  const from = formatActivityValue(row.fieldName, row.fromValue, userNamesById);
  const to = formatActivityValue(row.fieldName, row.toValue, userNamesById);

  if (row.fieldName === "status" && (row.fromValue == null || row.fromValue === "")) {
    return (
      <>
        <strong>{name}</strong> set {field} to <strong>{to}</strong>
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

export default function TaskActivityList({ rows, userNamesById = {} }) {
  const list = rows || [];
  if (!list.length) {
    return <p className="task-empty-inline">No changes recorded yet.</p>;
  }
  return (
    <ul className="task-timeline">
      {list.map((r, i) => {
        const isLast = i === list.length - 1;
        return (
          <li key={r.id} className={`task-timeline-item${isLast ? " is-last" : ""}`}>
            <span className="task-timeline-dot" aria-hidden="true" />
            <div className="task-timeline-content">
              <p className="task-timeline-text">{activityMessage(r, userNamesById)}</p>
              <time className="task-timeline-time">
                {r.changedAt ? formatTaskDateTime(r.changedAt) : ""}
              </time>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
