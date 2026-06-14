/** Task status pill — semantic colors using ERP CSS variables. */

const STATUS_CLASS = {
  Pending: "task-badge--pending",
  "In Progress": "task-badge--progress",
  Completed: "task-badge--completed",
  Cancelled: "task-badge--cancelled"
};

export default function TaskStatusBadge({ status }) {
  const label = String(status || "Pending");
  const cls = STATUS_CLASS[label] || "task-badge--pending";
  return (
    <span className={`task-badge ${cls}`}>{label}</span>
  );
}

export function TaskPriorityDot({ priority }) {
  const p = String(priority || "Medium");
  const cls =
    p === "High" ? "task-priority--high" : p === "Low" ? "task-priority--low" : "task-priority--medium";
  return (
    <span className={`task-priority ${cls}`} title={`Priority: ${p}`}>
      {p}
    </span>
  );
}
