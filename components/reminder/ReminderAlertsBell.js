"use client";

import { useEffect, useId, useRef } from "react";
import { useReminderAlerts } from "./ReminderAlertsProvider";
import { formatReminderDate } from "./reminderUtils";

export default function ReminderAlertsBell() {
  const menuId = useId();
  const rootRef = useRef(null);
  const {
    enabled,
    loading,
    alertCount,
    items,
    openReminder,
    dropdownOpen,
    setDropdownOpen
  } = useReminderAlerts();

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

  if (!enabled) return null;

  return (
    <div className="reminder-alerts-bell" ref={rootRef}>
      <button
        type="button"
        className={`reminder-alerts-bell-btn${dropdownOpen ? " is-open" : ""}`}
        onClick={() => setDropdownOpen((open) => !open)}
        aria-expanded={dropdownOpen}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-label={alertCount > 0 ? `${alertCount} reminder alerts` : "Reminder alerts"}
        title="Reminder alerts"
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
        <div id={menuId} className="reminder-alerts-dropdown" role="menu">
          <div className="reminder-alerts-dropdown-header">
            <span className="reminder-alerts-dropdown-title">Due reminders</span>
            {loading ? <span className="reminder-alerts-dropdown-loading">Updating…</span> : null}
          </div>

          {items.length === 0 ? (
            <p className="reminder-alerts-dropdown-empty">No overdue or due-today reminders.</p>
          ) : (
            <ul className="reminder-alerts-dropdown-list">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="reminder-alerts-dropdown-item"
                    role="menuitem"
                    onClick={() => openReminder(item.id)}
                  >
                    <span className="reminder-alerts-dropdown-item-title">
                      {item.reminderTitle || "Untitled"}
                    </span>
                    <span
                      className={`reminder-alerts-dropdown-item-due${item.isOverdue ? " is-overdue" : ""}`}
                    >
                      {item.isOverdue ? "Overdue · " : "Due today · "}
                      {item.dueDate ? formatReminderDate(item.dueDate) : "—"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
