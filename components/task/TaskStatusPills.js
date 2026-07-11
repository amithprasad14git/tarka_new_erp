"use client";

/**
 * React UI component: TaskStatusPills
 * Horizontal pill buttons to pick or filter a task status.
 * Keep module-specific business rules in lib/modules/*Client.js, not here.
 */

import { TASK_STATUSES, VIEW_ALL_STATUS } from "./taskUtils";

/**
 * @param {{ value: string, onChange?: (status: string) => void, disabled?: boolean, showAllOption?: boolean }} props
 */
export default function TaskStatusPills({ value, onChange, disabled = false, showAllOption = false }) {
  const options = showAllOption ? [VIEW_ALL_STATUS, ...TASK_STATUSES] : TASK_STATUSES;
  return (
    <div className="task-status-pills" role="group" aria-label="Task status">
      {options.map((st) => {
        const active = value === st;
        const slug =
          st === VIEW_ALL_STATUS ? "all" : st.toLowerCase().replace(/\s+/g, "-");
        return (
          <button
            key={st}
            type="button"
            className={`task-status-pill task-status-pill--${slug}${active ? " is-active" : ""}`}
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
