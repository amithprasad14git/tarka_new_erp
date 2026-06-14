const STATUS_CLASS = {
  Pending: "reminder-badge--pending",
  Completed: "reminder-badge--completed",
  Cancelled: "reminder-badge--cancelled"
};

export default function ReminderStatusBadge({ status }) {
  const label = String(status || "Pending");
  const cls = STATUS_CLASS[label] || "reminder-badge--pending";
  return <span className={`reminder-badge ${cls}`}>{label}</span>;
}

export function ReminderRecurrenceBadge({ recurrenceType, className = "" }) {
  const t = String(recurrenceType || "None").trim();
  if (!t || t === "None") return null;
  return (
    <span
      className={`reminder-recur-pill ${className}`.trim()}
      title={`Recurring: ${t}`}
    >
      <span className="reminder-recur-pill-icon" aria-hidden="true">
        ↻
      </span>
      {t}
    </span>
  );
}
