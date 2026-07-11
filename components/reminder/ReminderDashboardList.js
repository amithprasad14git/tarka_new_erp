"use client";

// Dashboard panel — scrollable pending reminder cards (My Reminders widget column 1).

/**
 * Compact list of pending reminders for the logged-in user.
 * Optional dueDateFilter from ReminderDueCalendarPanel click narrows to one day.
 * Clicking a card opens ReminderDetailPanel. API: GET /api/reminder?status=Pending.
 * Parent: MyRemindersWidget.js
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ReminderRecurrenceBadge } from "./ReminderStatusBadge";
import {
  formatReminderDate,
  isDueOverdue
} from "./reminderUtils";
import { formatApiErrorPayload, readJsonResponse } from "../../lib/fetchClientError";

/**
 * Due date chip with overdue vs upcoming styling.
 * @param {{ dueDate?: string, status?: string }} props
 */
function DueChip({ dueDate, status }) {
  if (!dueDate) {
    return <span className="reminder-due-chip reminder-due-chip--none">No date</span>;
  }
  const overdue = isDueOverdue(dueDate, status);
  const tone = overdue ? "reminder-due-chip--overdue" : "reminder-due-chip--upcoming";
  return (
    <span className={`reminder-due-chip ${tone}`} title={formatReminderDate(dueDate)}>
      {formatReminderDate(dueDate)}
    </span>
  );
}

/** Placeholder cards while reminder list is loading. */
function InlineListSkeleton() {
  return (
    <div className="reminder-dash-cards-skeleton" aria-hidden="true">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="reminder-dash-card-skeleton" />
      ))}
    </div>
  );
}

/** True when reminder has a recurrence rule (not one-time). */
function isRecurringReminder(reminder) {
  const type = String(reminder?.recurrenceType || "None").trim();
  return type && type !== "None";
}

/**
 * One clickable reminder card in the dashboard list.
 * @param {{ reminder: object, onOpen?: (reminder: object) => void }} props
 */
function ReminderCard({ reminder, onOpen }) {
  const overdue = isDueOverdue(reminder.dueDate, reminder.status);
  const recurring = isRecurringReminder(reminder);

  return (
    <li>
      <button
        type="button"
        className={`reminder-dash-card${overdue ? " reminder-dash-card--overdue" : ""}`}
        onClick={() => onOpen?.(reminder)}
      >
        <div className="reminder-dash-card-main">
          <span className="reminder-dash-card-title">{reminder.reminderTitle || "Untitled"}</span>
          <div className="reminder-dash-card-meta">
            <div className="reminder-dash-card-meta-lead">
              {recurring ? (
                <ReminderRecurrenceBadge
                  recurrenceType={reminder.recurrenceType}
                  className="reminder-dash-card-recur"
                />
              ) : null}
            </div>
            <DueChip dueDate={reminder.dueDate} status={reminder.status} />
          </div>
        </div>
      </button>
    </li>
  );
}

/**
 * Pending reminders list with optional calendar date filter.
 * @param {{
 *   dueDateFilter?: string | null,
 *   refreshKey?: number,
 *   onOpenReminder?: (reminder: object) => void
 * }} props
 */
export default function ReminderDashboardList({
  dueDateFilter = null,
  refreshKey = 0,
  onOpenReminder
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reminders, setReminders] = useState([]);

  /** Fetch pending reminders, optionally filtered to one due date. */
  const loadReminders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams({ status: "Pending" });
      if (dueDateFilter) {
        q.set("dueDate", dueDateFilter);
      }
      const res = await fetch(`/api/reminder?${q.toString()}`, { cache: "no-store" });
      const body = await readJsonResponse(res);
      if (!res.ok) {
        setError(formatApiErrorPayload(body, "Failed to load reminders"));
        return;
      }
      setReminders(body.rows || []);
    } catch {
      setError("Failed to load reminders");
    } finally {
      setLoading(false);
    }
  }, [dueDateFilter]);

  useEffect(() => {
    loadReminders();
  }, [loadReminders, refreshKey]);

  const emptyLabel = useMemo(() => {
    if (dueDateFilter) {
      return `No pending reminders due ${formatReminderDate(dueDateFilter)}`;
    }
    return "No pending reminders";
  }, [dueDateFilter]);

  return (
    <div className="reminder-dash-list reminder-dash-list--compact">
      {error ? <p className="reminder-form-error reminder-form-error--inline">{error}</p> : null}

      <div className="reminder-dash-panel-body reminder-dash-panel-body--list" aria-busy={loading}>
        {loading ? (
          <InlineListSkeleton />
        ) : reminders.length === 0 ? (
          <p className="reminder-empty-inline reminder-dash-list-empty">{emptyLabel}</p>
        ) : (
          <ul className="reminder-dash-cards">
            {reminders.map((r) => (
              <ReminderCard key={r.id} reminder={r} onOpen={onOpenReminder} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

