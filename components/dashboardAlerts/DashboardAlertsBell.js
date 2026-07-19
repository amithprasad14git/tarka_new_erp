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
import { useDashboardUser } from "../DashboardUserProvider";

/** Due-date line for a dropdown row (overdue vs plain date). */
function formatAlertDueLine(item) {
  const date = item.dueDate ? formatReminderDate(item.dueDate) : "—";
  if (item.isOverdue) return `Overdue · ${date}`;
  return date;
}

/**
 * Top-right corner label: creator for admins, otherwise created date.
 * @param {{ isAdmin: boolean, createdByLabel?: string, createdDate?: string | null }} args
 */
function topRightLabel({ isAdmin, createdByLabel, createdDate }) {
  const creator = String(createdByLabel || "").trim();
  const created = createdDate ? formatReminderDate(createdDate) : "";
  if (isAdmin && creator) return `Created by ${creator}`;
  if (created) return `Created ${created}`;
  return "";
}

/**
 * Topbar bell + due-items dropdown; mounts DashboardAlertsBanner toast.
 */
export default function DashboardAlertsBell() {
  const menuId = useId();
  const rootRef = useRef(null);
  const { role } = useDashboardUser();
  const isAdmin = Number(role) === 1;
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
                        {reminderItems.map((item) => {
                          const corner = topRightLabel({
                            isAdmin,
                            createdByLabel: item.createdByLabel,
                            createdDate: item.createdDate
                          });
                          const showCreatedMid =
                            isAdmin &&
                            String(item.createdByLabel || "").trim() &&
                            item.createdDate;
                          return (
                            <li key={`reminder-${item.id}`}>
                              <div className="reminder-alerts-dropdown-item reminder-alerts-dropdown-item--static">
                                <div className="reminder-alerts-dropdown-item-row">
                                  <span className="reminder-alerts-dropdown-item-title">
                                    {item.reminderTitle || "Untitled"}
                                  </span>
                                  {corner ? (
                                    <span className="reminder-alerts-dropdown-item-corner" title={corner}>
                                      {corner}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="reminder-alerts-dropdown-item-meta">
                                  <span className="reminder-alerts-dropdown-item-lead">
                                    {[
                                      item.isOverdue ? null : "Due today",
                                      showCreatedMid
                                        ? `Created ${formatReminderDate(item.createdDate)}`
                                        : null
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </span>
                                  <span
                                    className={`reminder-alerts-dropdown-item-due${item.isOverdue ? " is-overdue" : ""}`}
                                  >
                                    {formatAlertDueLine(item)}
                                  </span>
                                </div>
                              </div>
                            </li>
                          );
                        })}
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
                        {taskItems.map((item) => {
                          const corner = topRightLabel({
                            isAdmin,
                            createdByLabel: item.createdByLabel,
                            createdDate: item.createdDate
                          });
                          const assigneeLabel = String(item.assigneeLabel || "").trim();
                          return (
                            <li key={`task-${item.id}`}>
                              <div className="reminder-alerts-dropdown-item reminder-alerts-dropdown-item--static">
                                <div className="reminder-alerts-dropdown-item-row">
                                  <span className="reminder-alerts-dropdown-item-title">
                                    {item.taskTitle || "Untitled"}
                                  </span>
                                  {corner ? (
                                    <span className="reminder-alerts-dropdown-item-corner" title={corner}>
                                      {corner}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="reminder-alerts-dropdown-item-meta">
                                  <span className="reminder-alerts-dropdown-item-lead">
                                    {assigneeLabel ? `Assignee ${assigneeLabel}` : ""}
                                  </span>
                                  <span
                                    className={`reminder-alerts-dropdown-item-due${item.isOverdue ? " is-overdue" : ""}`}
                                  >
                                    {formatAlertDueLine(item)}
                                  </span>
                                </div>
                              </div>
                            </li>
                          );
                        })}
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
