"use client";

/**
 * React UI component: DashboardAlertsProvider
 * Context that polls reminder and task alert APIs for the topbar bell and toast.
 * Keep module-specific business rules in lib/modules/*Client.js, not here.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { readJsonResponse } from "../../lib/fetchClientError";

const POLL_MS = 5 * 60 * 1000;

const EMPTY_ALERTS = {
  overdueCount: 0,
  dueTodayCount: 0,
  alertCount: 0,
  items: []
};

const DashboardAlertsContext = createContext(null);

/** Access combined reminder/task alert state from DashboardAlertsProvider. */
export function useDashboardAlerts() {
  return useContext(DashboardAlertsContext);
}

/** @deprecated Use useDashboardAlerts */
export function useReminderAlerts() {
  return useContext(DashboardAlertsContext);
}

/** Normalize an alerts API response into counts + items (or empty on error/403). */
async function parseAlertsResponse(res) {
  if (!res) return { forbidden: false, data: EMPTY_ALERTS };
  if (res.status === 403) return { forbidden: true, data: EMPTY_ALERTS };
  if (!res.ok) return { forbidden: false, data: EMPTY_ALERTS };
  const body = await readJsonResponse(res);
  return {
    forbidden: false,
    data: {
      overdueCount: Number(body.overdueCount) || 0,
      dueTodayCount: Number(body.dueTodayCount) || 0,
      alertCount: Number(body.alertCount) || 0,
      items: Array.isArray(body.items) ? body.items : []
    }
  };
}

/**
 * Polls reminder and task alert APIs for topbar bell and toast.
 * @param {{ children: import("react").ReactNode }} props
 */
export default function DashboardAlertsProvider({ children }) {
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [tasksEnabled, setTasksEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [reminderAlerts, setReminderAlerts] = useState(EMPTY_ALERTS);
  const [taskAlerts, setTaskAlerts] = useState(EMPTY_ALERTS);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const bellVisible = remindersEnabled || tasksEnabled;

  const alertCount = useMemo(() => {
    let n = 0;
    if (remindersEnabled) n += reminderAlerts.alertCount;
    if (tasksEnabled) n += taskAlerts.alertCount;
    return n;
  }, [remindersEnabled, tasksEnabled, reminderAlerts.alertCount, taskAlerts.alertCount]);

  const refresh = useCallback(async () => {
    if (!remindersEnabled && !tasksEnabled) return;
    setLoading(true);
    try {
      const [reminderRes, taskRes] = await Promise.all([
        remindersEnabled ? fetch("/api/reminder/alerts", { cache: "no-store" }) : null,
        tasksEnabled ? fetch("/api/task/alerts", { cache: "no-store" }) : null
      ]);

      if (remindersEnabled && reminderRes) {
        const { forbidden, data } = await parseAlertsResponse(reminderRes);
        if (forbidden) {
          setRemindersEnabled(false);
          setReminderAlerts(EMPTY_ALERTS);
        } else {
          setReminderAlerts(data);
        }
      }

      if (tasksEnabled && taskRes) {
        const { forbidden, data } = await parseAlertsResponse(taskRes);
        if (forbidden) {
          setTasksEnabled(false);
          setTaskAlerts(EMPTY_ALERTS);
        } else {
          setTaskAlerts(data);
        }
      }
    } catch {
      // Non-blocking supplementary UI.
    } finally {
      setLoading(false);
    }
  }, [remindersEnabled, tasksEnabled]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "visible") refresh();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [refresh]);

  const value = {
    bellVisible,
    remindersEnabled,
    tasksEnabled,
    loading,
    alertCount,
    reminderItems: reminderAlerts.items,
    taskItems: taskAlerts.items,
    reminderOverdue: reminderAlerts.overdueCount,
    reminderDueToday: reminderAlerts.dueTodayCount,
    taskOverdue: taskAlerts.overdueCount,
    taskDueToday: taskAlerts.dueTodayCount,
    refresh,
    dropdownOpen,
    setDropdownOpen,
    enabled: bellVisible,
    overdueCount: reminderAlerts.overdueCount,
    dueTodayCount: reminderAlerts.dueTodayCount,
    items: reminderAlerts.items
  };

  return <DashboardAlertsContext.Provider value={value}>{children}</DashboardAlertsContext.Provider>;
}
