"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import ReminderDetailPanel from "./ReminderDetailPanel";
import { readJsonResponse } from "../../lib/fetchClientError";

const POLL_MS = 5 * 60 * 1000;

const ReminderAlertsContext = createContext(null);

export function useReminderAlerts() {
  return useContext(ReminderAlertsContext);
}

/**
 * Polls GET /api/reminder/alerts while the dashboard is open.
 * Hosts ReminderDetailPanel for global open-from-bell flows.
 */
export default function ReminderAlertsProvider({ children }) {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [overdueCount, setOverdueCount] = useState(0);
  const [dueTodayCount, setDueTodayCount] = useState(0);
  const [alertCount, setAlertCount] = useState(0);
  const [items, setItems] = useState([]);
  const [detailId, setDetailId] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res = await fetch("/api/reminder/alerts", { cache: "no-store" });
      if (res.status === 403) {
        setEnabled(false);
        setOverdueCount(0);
        setDueTodayCount(0);
        setAlertCount(0);
        setItems([]);
        return;
      }
      const body = await readJsonResponse(res);
      if (!res.ok) return;
      setOverdueCount(Number(body.overdueCount) || 0);
      setDueTodayCount(Number(body.dueTodayCount) || 0);
      setAlertCount(Number(body.alertCount) || 0);
      setItems(Array.isArray(body.items) ? body.items : []);
    } catch {
      // Non-blocking: alerts are supplementary UI.
    } finally {
      setLoading(false);
    }
  }, [enabled]);

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

  const openReminder = useCallback((id) => {
    setDropdownOpen(false);
    setDetailId(id);
  }, []);

  const value = {
    enabled,
    loading,
    overdueCount,
    dueTodayCount,
    alertCount,
    items,
    refresh,
    openReminder,
    dropdownOpen,
    setDropdownOpen
  };

  return (
    <ReminderAlertsContext.Provider value={value}>
      {children}
      <ReminderDetailPanel
        open={detailId != null}
        reminderId={detailId}
        onClose={() => setDetailId(null)}
        onUpdated={refresh}
      />
    </ReminderAlertsContext.Provider>
  );
}
