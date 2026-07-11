"use client";

/**
 * React UI component: TaskBucketSwitch
 * Toggle between “My Tasks” and “Assigned Tasks” scopes in the task list modal.
 * Keep module-specific business rules in lib/modules/*Client.js, not here.
 */

/** Scope options for the task list bucket switch. */
export const BUCKET_OPTIONS = [
  { value: "assigned_to_me", label: "My Tasks" },
  { value: "assigned_by_me", label: "Assigned Tasks" }
];

/** Help copy shown under each bucket selection. */
export const BUCKET_HELP = {
  assigned_to_me:
    "Tasks assigned to you or where you are the follow-up person — update status and add comments.",
  assigned_by_me:
    "Tasks you created for others — update details (title, due date, priority, follow-up person)."
};

/**
 * Segmented or pill control for task list scope.
 * @param {{ value: string, onChange?: (v: string) => void, showHelp?: boolean, variant?: "segmented" | "pill" }} props
 */
export default function TaskBucketSwitch({
  value,
  onChange,
  showHelp = true,
  variant = "segmented"
}) {
  const help = showHelp ? BUCKET_HELP[value] || "" : "";
  const isPill = variant === "pill";

  return (
    <div className="task-bucket-switch-wrap">
      <div
        className={`task-bucket-switch${isPill ? " task-bucket-switch--pill" : ""}`}
        role={isPill ? "group" : "tablist"}
        aria-label="Task scope"
      >
        {BUCKET_OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role={isPill ? undefined : "tab"}
              aria-selected={isPill ? undefined : active}
              aria-pressed={isPill ? active : undefined}
              className={
                isPill
                  ? `task-bucket-pill-btn${active ? " is-active" : ""}`
                  : `task-bucket-switch-btn${active ? " is-active" : ""}`
              }
              onClick={() => onChange?.(opt.value)}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {help ? <p className="task-bucket-help">{help}</p> : null}
    </div>
  );
}
