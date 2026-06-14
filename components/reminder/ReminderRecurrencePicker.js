"use client";

import { RECURRENCE_TYPES } from "./reminderUtils";

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
