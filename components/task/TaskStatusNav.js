"use client";

/**
 * React UI component: TaskStatusNav
 * Status filter rendered as a strip of stat tiles with counts for the task list modal.
 * Keep module-specific business rules in lib/modules/*Client.js, not here.
 */

import { TASK_STATUSES, TASK_STATUS_COLORS, VIEW_ALL_STATUS } from "./taskUtils";

const NAV_ITEMS = [...TASK_STATUSES, VIEW_ALL_STATUS];

/**
 * @param {{ activeStatus: string, onChange?: (status: string) => void, counts?: Record<string, number>, loading?: boolean }} props
 */
export default function TaskStatusNav({ activeStatus, onChange, counts, loading }) {
  return (
    <nav className="task-status-nav" aria-label="Filter by status">
      <ul className="task-status-nav-list">
        {NAV_ITEMS.map((status) => {
          const active = activeStatus === status;
          const count = counts?.[status];
          const showCount = loading ? "—" : String(count ?? 0);
          const dotColor = status !== VIEW_ALL_STATUS ? TASK_STATUS_COLORS[status] : null;

          return (
            <li key={status}>
              <button
                type="button"
                className={`task-status-nav-item${active ? " is-active" : ""}`}
                style={dotColor ? { "--lv-tint": dotColor } : undefined}
                aria-current={active ? "true" : undefined}
                onClick={() => onChange?.(status)}
              >
                {dotColor ? (
                  <span
                    className="task-status-nav-dot"
                    style={{ background: dotColor }}
                    aria-hidden="true"
                  />
                ) : (
                  <span className="task-status-nav-dot task-status-nav-dot--all" aria-hidden="true" />
                )}
                <span className="task-status-nav-label">{status}</span>
                <span className="task-status-nav-count">{showCount}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
