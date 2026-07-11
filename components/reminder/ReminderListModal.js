"use client";

// Dashboard drilldown — full reminder list modal (View all from My Reminders).

/**
 * Paginated reminder table in a full-screen modal. Filter by status tab and search.
 * Opens ReminderDetailPanel via onSelectReminder. Parent: MyRemindersWidget.js.
 * API: GET /api/reminder
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import ReminderExpandableSearch from "./ReminderExpandableSearch";
import ReminderStatusNav from "./ReminderStatusNav";
import ReminderStatusBadge, { ReminderRecurrenceBadge } from "./ReminderStatusBadge";
import PaginationBar from "../PaginationBar";
import {
  REMINDER_STATUSES,
  VIEW_ALL_STATUS,
  daysPastDue,
  formatReminderDate,
  overdueDaysSeverity,
  truncateText,
  sortRemindersForListView
} from "./reminderUtils";
import { formatApiErrorPayload, readJsonResponse } from "../../lib/fetchClientError";
import ReminderModalPortal from "./ReminderModalPortal";

/** Split flat reminder list into buckets keyed by REMINDER_STATUSES. */
function groupRemindersByStatus(reminders) {
  const groups = Object.fromEntries(REMINDER_STATUSES.map((st) => [st, []]));
  for (const r of reminders) {
    const st = REMINDER_STATUSES.includes(r.status) ? r.status : "Pending";
    groups[st].push(r);
  }
  return groups;
}

/** Map widget drilldown status (or VIEW_ALL) to modal initial tab. */
function resolveInitialStatus(initialStatus) {
  if (initialStatus === VIEW_ALL_STATUS) return VIEW_ALL_STATUS;
  if (REMINDER_STATUSES.includes(initialStatus)) return initialStatus;
  return "Pending";
}

/** Placeholder rows while reminder list API is loading. */
function TableListSkeleton() {
  return (
    <div className="reminder-list-table-skeleton" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="reminder-list-table-skeleton-row" />
      ))}
    </div>
  );
}

/** Overdue day count with color severity. */
function DaysPastDueCell({ dueDate, status }) {
  const days = daysPastDue(dueDate, status);
  const severity = overdueDaysSeverity(days);
  if (days == null) return <span className="reminder-group-muted">—</span>;
  if (days <= 0) return <span className="reminder-group-overdue reminder-group-overdue--none">—</span>;
  return <span className={`reminder-group-overdue reminder-group-overdue--${severity}`}>{days}d</span>;
}

/** Single row in the reminder list table — Open launches detail panel. */
function ReminderListTableRow({ reminder, onOpen }) {
  return (
    <tr className="reminder-group-row">
      <td className="reminder-group-col-title">
        <span className="reminder-group-task-title">{reminder.reminderTitle || "Untitled"}</span>
      </td>
      <td className="reminder-group-col-notes">
        <span className="reminder-group-desc">
          {reminder.notes ? truncateText(reminder.notes, 60) : "—"}
        </span>
      </td>
      <td className="reminder-group-col-due">
        {reminder.dueDate ? formatReminderDate(reminder.dueDate) : <span className="reminder-group-muted">—</span>}
      </td>
      <td className="reminder-group-col-overdue">
        <DaysPastDueCell dueDate={reminder.dueDate} status={reminder.status} />
      </td>
      <td className="reminder-group-col-status">
        <ReminderStatusBadge status={reminder.status} />
      </td>
      <td className="reminder-group-col-recurrence">
        {reminder.recurrenceType && reminder.recurrenceType !== "None" ? (
          <ReminderRecurrenceBadge recurrenceType={reminder.recurrenceType} />
        ) : (
          <span className="reminder-group-muted">—</span>
        )}
      </td>
      <td className="reminder-group-col-action">
        <button
          type="button"
          className="master-btn master-btn-sm master-btn-outline reminder-group-edit-btn"
          onClick={() => onOpen(reminder)}
        >
          Open
        </button>
      </td>
    </tr>
  );
}

/** Shown when search or status filter returns zero reminders. */
function ListEmptyState({ search, activeStatus }) {
  const statusLabel =
    activeStatus === VIEW_ALL_STATUS ? "reminders" : `${activeStatus.toLowerCase()} reminders`;
  return (
    <div className="reminder-list-modal-empty">
      <div className="reminder-list-modal-empty-icon" aria-hidden="true">
        ◫
      </div>
      <p className="reminder-list-modal-empty-title">No reminders found</p>
      <p className="reminder-list-modal-empty-text">
        {search.trim()
          ? "Try a different search term or switch status filter."
          : `There are no ${statusLabel} in this view yet.`}
      </p>
    </div>
  );
}

/**
 * Full-screen reminder list modal with status tabs, search, pagination.
 * @param {{
 *   open: boolean,
 *   initialStatus?: string,
 *   refreshKey?: number,
 *   onClose: () => void,
 *   onSelectReminder: (reminder: object) => void,
 *   onAddReminder?: () => void
 * }} props
 */
export default function ReminderListModal({
  open,
  initialStatus,
  refreshKey = 0,
  onClose,
  onSelectReminder,
  onAddReminder
}) {
  const titleId = useId();
  const prevOpenRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reminders, setReminders] = useState([]);
  const [search, setSearch] = useState("");
  const [activeStatus, setActiveStatus] = useState(() => resolveInitialStatus(initialStatus));
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setSearch("");
      setActiveStatus(resolveInitialStatus(initialStatus));
      setPage(1);
      setLimit(10);
    }
    prevOpenRef.current = open;
  }, [open, initialStatus]);

  useEffect(() => {
    setPage(1);
  }, [activeStatus, search]);

  /** Fetch all reminders for the logged-in user (filtered by status tab client-side). */
  const loadReminders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/reminder", { cache: "no-store" });
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
  }, []);

  useEffect(() => {
    if (!open) return;
    loadReminders();
  }, [open, refreshKey, loadReminders]);

  const searchFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reminders;
    return reminders.filter((r) => {
      const hay = [r.reminderTitle, r.notes, r.status, r.recurrenceType]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [reminders, search]);

  const statusCounts = useMemo(() => {
    const grouped = groupRemindersByStatus(searchFiltered);
    return {
      ...Object.fromEntries(REMINDER_STATUSES.map((st) => [st, grouped[st].length])),
      [VIEW_ALL_STATUS]: searchFiltered.length
    };
  }, [searchFiltered]);

  const statusFiltered = useMemo(() => {
    let filtered = searchFiltered;
    if (activeStatus !== VIEW_ALL_STATUS) {
      filtered = searchFiltered.filter((r) => {
        const st = REMINDER_STATUSES.includes(r.status) ? r.status : "Pending";
        return st === activeStatus;
      });
    }
    return sortRemindersForListView(filtered, activeStatus);
  }, [searchFiltered, activeStatus]);

  const totalPages = Math.max(1, Math.ceil(statusFiltered.length / limit) || 1);
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedReminders = useMemo(() => {
    const start = (safePage - 1) * limit;
    return statusFiltered.slice(start, start + limit);
  }, [statusFiltered, safePage, limit]);

  if (!open) return null;

  const statusTotalCount = statusFiltered.length;

  return (
    <ReminderModalPortal>
      <div className="reminder-modal-backdrop" role="presentation">
        <div
          className="reminder-modal reminder-modal--reminder-list reminder-modal--reminder-list-split"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <header className="reminder-modal-header reminder-list-modal-header">
            <div className="reminder-modal-heading">
              <h2 id={titleId} className="reminder-modal-title">
                Reminders
              </h2>
            </div>
            <button type="button" className="reminder-modal-close" onClick={() => onClose?.()} aria-label="Close">
              ×
            </button>
          </header>

          {error ? (
            <p className="reminder-form-error reminder-list-modal-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="reminder-list-split-body">
            <ReminderStatusNav
              activeStatus={activeStatus}
              onChange={setActiveStatus}
              counts={statusCounts}
              loading={loading}
            />

            <div className="reminder-list-table-pane">
              <div className="reminder-list-table-toolbar">
                <ReminderExpandableSearch open={open} value={search} onChange={setSearch} />
                <span className="reminder-list-command-divider" aria-hidden="true" />
                <div className="reminder-list-modal-toolbar-meta">
                  <button
                    type="button"
                    className={`reminder-list-modal-refresh${loading ? " is-spinning" : ""}`}
                    onClick={loadReminders}
                    disabled={loading}
                    aria-label="Refresh list"
                    title="Refresh"
                  >
                    ↻
                  </button>
                </div>
                <button
                  type="button"
                  className="master-btn master-btn-primary reminder-list-toolbar-add-btn"
                  onClick={() => onAddReminder?.()}
                >
                  Add reminder
                </button>
              </div>

              {loading ? (
                <TableListSkeleton />
              ) : statusTotalCount === 0 ? (
                <ListEmptyState search={search} activeStatus={activeStatus} />
              ) : (
                <>
                  <div className="reminder-list-table-wrap">
                    <table className="reminder-status-group-table reminder-list-split-table">
                      <thead>
                        <tr>
                          <th>Title</th>
                          <th>Notes</th>
                          <th>Due date</th>
                          <th>Days past due</th>
                          <th>Status</th>
                          <th>Recurrence</th>
                          <th className="reminder-group-col-action">
                            <span className="sr-only">Action</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedReminders.map((r) => (
                          <ReminderListTableRow
                            key={r.id}
                            reminder={r}
                            onOpen={onSelectReminder}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="reminder-list-modal-footer">
                    <PaginationBar
                      page={safePage}
                      totalPages={totalPages}
                      total={statusTotalCount}
                      limit={limit}
                      onPageChange={setPage}
                      onLimitChange={(next) => {
                        setLimit(next);
                        setPage(1);
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </ReminderModalPortal>
  );
}

