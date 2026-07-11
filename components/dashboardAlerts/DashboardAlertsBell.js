"use client";

/**
 * React UI component: DashboardAlertsBell
 * Topbar bell with dropdown listing overdue / due-today reminders and tasks.
 * Keep module-specific business rules in lib/modules/*Client.js, not here.
 */

import { useEffect, useId, useRef } from "react";
import { useDashboardAlerts } from "./DashboardAlertsProvider";
import { formatReminderDate } from "../reminder/reminderUtils";
import DashboardAlertsBanner from "./DashboardAlertsBanner";

/** CSS modifier for task status chips in the dropdown. */
function alertStatusClass(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();
  if (normalized === "pending") return "reminder-alerts-dropdown-item-status--pending";
  if (normalized === "in progress") return "reminder-alerts-dropdown-item-status--in-progress";
  return "";
}

/** Due-date line for a dropdown row (overdue vs plain date). */
function formatAlertDueLine(item) {
  const date = item.dueDate ? formatReminderDate(item.dueDate) : "—";
  if (item.isOverdue) return `Overdue · ${date}`;
  return date;
}

/**
 * Topbar bell + due-items dropdown; mounts DashboardAlertsBanner toast.
 */
export default function DashboardAlertsBell() {
  const menuId = useId();
  const rootRef = useRef(null);
  const {
    bellVisible,
    remindersEnabled,
    tasksEnabled,
    loading,
    alertCount,
    reminderItems,
    taskItems,
    dropdownOpen,
    setDropdownOpen
  } = useDashboardAlerts();

  useEffect(() => {
    if (!dropdownOpen) return;
    function onPointerDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [dropdownOpen, setDropdownOpen]);

  if (!bellVisible) return null;

  const showReminders = remindersEnabled;
  const showTasks = tasksEnabled;
  const hasReminderRows = showReminders && reminderItems.length > 0;
  const hasTaskRows = showTasks && taskItems.length > 0;
  const isEmpty = !hasReminderRows && !hasTaskRows;

  return (
    <div className="reminder-alerts-bell" ref={rootRef}>
      <button
        type="button"
        className={`reminder-alerts-bell-btn${dropdownOpen ? " is-open" : ""}`}
        onClick={() => setDropdownOpen((open) => !open)}
        aria-expanded={dropdownOpen}
        aria-haspopup="true"
        aria-controls={menuId}
        aria-label={alertCount > 0 ? `${alertCount} due items` : "Due reminders and tasks"}
        title="Due reminders and tasks"
      >
        <span className="reminder-alerts-bell-icon" aria-hidden="true">
          🔔
        </span>
        {alertCount > 0 ? (
          <span className="reminder-alerts-bell-badge" aria-hidden="true">
            {alertCount > 99 ? "99+" : alertCount}
          </span>
        ) : null}
      </button>

      {dropdownOpen ? (
        <div id={menuId} className="reminder-alerts-dropdown" role="region" aria-label="Due items">
          <div className="reminder-alerts-dropdown-header">
            <span className="reminder-alerts-dropdown-title">Due items</span>
            {loading ? <span className="reminder-alerts-dropdown-loading">Updating…</span> : null}
          </div>

          <div className="reminder-alerts-dropdown-body">
            {isEmpty ? (
              <p className="reminder-alerts-dropdown-empty">No overdue or due-today items.</p>
            ) : (
              <>
                {showReminders ? (
                  <div className="reminder-alerts-dropdown-section">
                    <p className="reminder-alerts-dropdown-section-label">Reminders</p>
                    {hasReminderRows ? (
                      <ul className="reminder-alerts-dropdown-list">
                        {reminderItems.map((item) => (
                          <li key={`reminder-${item.id}`}>
                            <div className="reminder-alerts-dropdown-item reminder-alerts-dropdown-item--static">
                              <span className="reminder-alerts-dropdown-item-title">
                                {item.reminderTitle || "Untitled"}
                              </span>
                              <div className="reminder-alerts-dropdown-item-meta">
                                <span className="reminder-alerts-dropdown-item-lead">
                                  {item.isOverdue ? "" : "Due today"}
                                </span>
                                <span
                                  className={`reminder-alerts-dropdown-item-due${item.isOverdue ? " is-overdue" : ""}`}
                                >
                                  {formatAlertDueLine(item)}
                                </span>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="reminder-alerts-dropdown-section-empty">None due.</p>
                    )}
                  </div>
                ) : null}

                {showTasks ? (
                  <div className="reminder-alerts-dropdown-section">
                    <p className="reminder-alerts-dropdown-section-label">Tasks</p>
                    {hasTaskRows ? (
                      <ul className="reminder-alerts-dropdown-list">
                        {taskItems.map((item) => (
                          <li key={`task-${item.id}`}>
                            <div className="reminder-alerts-dropdown-item reminder-alerts-dropdown-item--static">
                              <span className="reminder-alerts-dropdown-item-title">
                                {item.taskTitle || "Untitled"}
                              </span>
                              <div className="reminder-alerts-dropdown-item-meta">
                                <span
                                  className={`reminder-alerts-dropdown-item-status ${alertStatusClass(item.status)}`.trim()}
                                >
                                  {item.status}
                                </span>
                                <span
                                  className={`reminder-alerts-dropdown-item-due${item.isOverdue ? " is-overdue" : ""}`}
                                >
                                  {formatAlertDueLine(item)}
                                </span>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="reminder-alerts-dropdown-section-empty">None due.</p>
                    )}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}

      <DashboardAlertsBanner />
    </div>
  );
}
