"use client";

/**
 * React UI component: ReminderStatusPills
 * Horizontal pill buttons to pick or filter a reminder status.
 * Keep module-specific business rules in lib/modules/*Client.js, not here.
 */

import { REMINDER_STATUSES, VIEW_ALL_STATUS } from "./reminderUtils";

/**
 * @param {{ value: string, onChange?: (status: string) => void, disabled?: boolean, showAllOption?: boolean, extraOptions?: string[] }} props
 */
export default function ReminderStatusPills({ value, onChange, disabled = false, showAllOption = false, extraOptions = [] }) {
  const options = [
    ...(extraOptions || []),
    ...(showAllOption ? [VIEW_ALL_STATUS] : []),
    ...REMINDER_STATUSES
  ];
  return (
    <div className="reminder-status-pills" role="group" aria-label="Reminder status">
      {options.map((st) => {
        const active = value === st;
        const slug = st === VIEW_ALL_STATUS ? "all" : st.toLowerCase().replace(/\s+/g, "-");
        return (
          <button
            key={st}
            type="button"
            className={`reminder-status-pill reminder-status-pill--${slug}${active ? " is-active" : ""}`}
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange?.(st)}
          >
            {st}
          </button>
        );
      })}
    </div>
  );
}
