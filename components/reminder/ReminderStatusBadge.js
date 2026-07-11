/**
 * React UI component: ReminderStatusBadge
 * Colored status pill and optional recurrence chip for reminder list/detail rows.
 * Keep module-specific business rules in lib/modules/*Client.js, not here.
 */

const STATUS_CLASS = {
  Pending: "reminder-badge--pending",
  Completed: "reminder-badge--completed",
  Cancelled: "reminder-badge--cancelled"
};

/**
 * @param {{ status?: string }} props
 */
export default function ReminderStatusBadge({ status }) {
  const label = String(status || "Pending");
  const cls = STATUS_CLASS[label] || "reminder-badge--pending";
  return <span className={`reminder-badge ${cls}`}>{label}</span>;
}

/**
 * Compact recurrence label (hidden when None).
 * @param {{ recurrenceType?: string, className?: string }} props
 */
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
