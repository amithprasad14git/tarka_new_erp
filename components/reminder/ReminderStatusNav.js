"use client";

/**
 * React UI component: ReminderStatusNav
 * Sidebar status filter with counts for the reminder list modal.
 * Keep module-specific business rules in lib/modules/*Client.js, not here.
 */

import { REMINDER_STATUSES, REMINDER_STATUS_COLORS, VIEW_ALL_STATUS } from "./reminderUtils";

const NAV_ITEMS = [...REMINDER_STATUSES, VIEW_ALL_STATUS];

/**
 * @param {{ activeStatus: string, onChange?: (status: string) => void, counts?: Record<string, number>, loading?: boolean }} props
 */
export default function ReminderStatusNav({ activeStatus, onChange, counts, loading }) {
  return (
    <nav className="reminder-status-nav" aria-label="Filter by status">
      <ul className="reminder-status-nav-list">
        {NAV_ITEMS.map((status) => {
          const active = activeStatus === status;
          const count = counts?.[status];
          const showCount = loading ? "—" : String(count ?? 0);
          const dotColor = status !== VIEW_ALL_STATUS ? REMINDER_STATUS_COLORS[status] : null;

          return (
            <li key={status}>
              <button
                type="button"
                className={`reminder-status-nav-item${active ? " is-active" : ""}`}
                aria-current={active ? "true" : undefined}
                onClick={() => onChange?.(status)}
              >
                {dotColor ? (
                  <span className="reminder-status-nav-dot" style={{ background: dotColor }} aria-hidden="true" />
                ) : (
                  <span className="reminder-status-nav-dot reminder-status-nav-dot--all" aria-hidden="true" />
                )}
                <span className="reminder-status-nav-label">{status}</span>
                <span className="reminder-status-nav-count">{showCount}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
