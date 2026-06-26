"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useReminderAlerts } from "./ReminderAlertsProvider";

const DISMISS_KEY = "reminder-alerts-banner-dismissed";

function bannerMessage(overdueCount, dueTodayCount) {
  const parts = [];
  if (overdueCount > 0) {
    parts.push(`${overdueCount} overdue`);
  }
  if (dueTodayCount > 0) {
    parts.push(`${dueTodayCount} due today`);
  }
  if (!parts.length) return "";
  const summary = parts.join(" and ");
  const noun = overdueCount + dueTodayCount === 1 ? "reminder" : "reminders";
  return `You have ${summary} ${noun}.`;
}

export default function ReminderAlertsBanner() {
  const router = useRouter();
  const { enabled, alertCount, overdueCount, dueTodayCount, setDropdownOpen } = useReminderAlerts();
  const [dismissedForCount, setDismissedForCount] = useState(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(DISMISS_KEY);
      setDismissedForCount(stored != null ? Number(stored) : null);
    } catch {
      setDismissedForCount(null);
    }
  }, []);

  if (!enabled || alertCount <= 0) return null;
  if (dismissedForCount === alertCount) return null;

  const message = bannerMessage(overdueCount, dueTodayCount);
  if (!message) return null;

  function handleDismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, String(alertCount));
    } catch {
      // ignore
    }
    setDismissedForCount(alertCount);
  }

  function handleView() {
    setDropdownOpen(true);
    router.push("/dashboard");
  }

  return (
    <div className="reminder-alerts-banner" role="status">
      <p className="reminder-alerts-banner-text">{message}</p>
      <div className="reminder-alerts-banner-actions">
        <button type="button" className="reminder-alerts-banner-view" onClick={handleView}>
          View
        </button>
        <button type="button" className="reminder-alerts-banner-dismiss" onClick={handleDismiss} aria-label="Dismiss">
          ×
        </button>
      </div>
    </div>
  );
}
