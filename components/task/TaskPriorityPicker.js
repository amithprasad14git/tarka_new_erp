"use client";

/**
 * React UI component: TaskPriorityPicker
 * Low / Medium / High priority pill control for task create and detail forms.
 * Keep module-specific business rules in lib/modules/*Client.js, not here.
 */

const PRIORITIES = ["Low", "Medium", "High"];

/**
 * @param {{ value?: string, onChange?: (priority: string) => void, readOnly?: boolean }} props
 */
export default function TaskPriorityPicker({ value, onChange, readOnly = false }) {
  const current = String(value || "Medium");

  return (
    <div
      className={`task-priority-pills${readOnly ? " task-priority-pills--readonly" : ""}`}
      role={readOnly ? "group" : "radiogroup"}
      aria-label="Priority"
    >
      {PRIORITIES.map((p) => {
        const slug = p.toLowerCase();
        const active = current === p;
        return (
          <button
            key={p}
            type="button"
            role={readOnly ? undefined : "radio"}
            aria-checked={readOnly ? undefined : active}
            className={`task-priority-pill task-priority-pill--${slug}${active ? " is-active" : ""}`}
            disabled={readOnly}
            tabIndex={readOnly ? -1 : active ? 0 : -1}
            onClick={() => !readOnly && onChange?.(p)}
          >
            {p}
          </button>
        );
      })}
    </div>
  );
}
