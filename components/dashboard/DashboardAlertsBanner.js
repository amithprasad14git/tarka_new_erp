"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDashboardAlerts } from "./DashboardAlertsProvider";

const TOAST_RESHOW_MS = 15 * 60 * 1000;
const RESHOW_CHECK_MS = 30 * 1000;

function bannerMessage({
  remindersEnabled,
  tasksEnabled,
  reminderOverdue,
  reminderDueToday,
  taskOverdue,
  taskDueToday
}) {
  const parts = [];

  if (remindersEnabled) {
    const reminderParts = [];
    if (reminderOverdue > 0) reminderParts.push(`${reminderOverdue} overdue reminder${reminderOverdue === 1 ? "" : "s"}`);
    if (reminderDueToday > 0) {
      reminderParts.push(`${reminderDueToday} due-today reminder${reminderDueToday === 1 ? "" : "s"}`);
    }
    if (reminderParts.length) parts.push(reminderParts.join(" and "));
  }

  if (tasksEnabled) {
    const taskParts = [];
    if (taskOverdue > 0) taskParts.push(`${taskOverdue} overdue task${taskOverdue === 1 ? "" : "s"}`);
    if (taskDueToday > 0) taskParts.push(`${taskDueToday} due-today task${taskDueToday === 1 ? "" : "s"}`);
    if (taskParts.length) parts.push(taskParts.join(" and "));
  }

  if (!parts.length) return "";
  return `You have ${parts.join(", ")}.`;
}

export default function DashboardAlertsBanner() {
  const {
    bellVisible,
    alertCount,
    remindersEnabled,
    tasksEnabled,
    reminderOverdue,
    reminderDueToday,
    taskOverdue,
    taskDueToday,
    dropdownOpen,
    setDropdownOpen
  } = useDashboardAlerts();
  const [visible, setVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const lastDismissedAtRef = useRef(null);

  const tryShowToast = useCallback(() => {
    if (!bellVisible || alertCount <= 0) {
      setVisible(false);
      setIsExiting(false);
      return;
    }
    const dismissedAt = lastDismissedAtRef.current;
    if (dismissedAt == null || Date.now() - dismissedAt >= TOAST_RESHOW_MS) {
      setIsExiting(false);
      setVisible(true);
    }
  }, [bellVisible, alertCount]);

  useEffect(() => {
    tryShowToast();
  }, [tryShowToast]);

  useEffect(() => {
    if (!bellVisible || alertCount <= 0) return undefined;
    const timer = setInterval(tryShowToast, RESHOW_CHECK_MS);
    return () => clearInterval(timer);
  }, [bellVisible, alertCount, tryShowToast]);

  const message = bannerMessage({
    remindersEnabled,
    tasksEnabled,
    reminderOverdue,
    reminderDueToday,
    taskOverdue,
    taskDueToday
  });

  if (!message || dropdownOpen || (!visible && !isExiting)) return null;

  function handleDismiss() {
    setIsExiting(true);
  }

  function handleAnimationEnd(e) {
    if (e.animationName !== "reminder-alerts-toast-out") return;
    setIsExiting(false);
    setVisible(false);
    lastDismissedAtRef.current = Date.now();
  }

  function handleView() {
    setDropdownOpen(true);
  }

  return (
    <div
      className={`reminder-alerts-toast${isExiting ? " is-exiting" : ""}`}
      role="status"
      onAnimationEnd={handleAnimationEnd}
    >
      <span className="reminder-alerts-toast-icon" aria-hidden="true">
        🔔
      </span>
      <p className="reminder-alerts-toast-text">{message}</p>
      <div className="reminder-alerts-toast-actions">
        <button type="button" className="reminder-alerts-toast-view" onClick={handleView}>
          View
        </button>
        <button type="button" className="reminder-alerts-toast-dismiss" onClick={handleDismiss} aria-label="Dismiss">
          ×
        </button>
      </div>
    </div>
  );
}
