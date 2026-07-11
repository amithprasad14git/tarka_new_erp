"use client";

/**
 * React UI component: ReminderRecurrencePicker
 * Pill control to choose None / Daily / Weekly / Monthly recurrence on a reminder.
 * Keep module-specific business rules in lib/modules/*Client.js, not here.
 */

import { RECURRENCE_TYPES } from "./reminderUtils";

/**
 * @param {{ value?: string, onChange?: (type: string) => void, disabled?: boolean }} props
 */
export default function ReminderRecurrencePicker({ value, onChange, disabled = false }) {
  const current = value || "None";
  return (
    <div className="reminder-priority-pills" role="group" aria-label="Recurrence">
      {RECURRENCE_TYPES.map((type) => {
        const active = current === type;
        const slug = type.toLowerCase();
        return (
          <button
            key={type}
            type="button"
            className={`reminder-priority-pill reminder-priority-pill--medium${active ? " is-active" : ""}`}
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange?.(type)}
          >
            {type}
          </button>
        );
      })}
    </div>
  );
}
