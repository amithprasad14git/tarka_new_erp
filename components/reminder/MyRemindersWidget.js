"use client";

// Dashboard widget UI — My Reminders (list, calendar + modals).

/**
 * Landing widget for the user's reminders.
 * Two panels: scrollable reminder cards (filterable by calendar date) and due calendar.
 * Modals: ReminderListModal, ReminderCreateModal, ReminderDetailPanel.
 * Data: parent cache via DashboardWidgetLoader; falls back to GET /api/dashboard/my_reminders.
 * Guide: README.md#5a-landing-dashboards
 */

import { useCallback, useEffect, useState } from "react";
import DashboardSectionHeader from "../dashboards/shared/DashboardSectionHeader";
import DashboardWidgetRefreshHeader from "../dashboards/shared/DashboardWidgetRefreshHeader";
import ReminderDashboardList from "./ReminderDashboardList";
import ReminderDueCalendarPanel from "./ReminderDueCalendarPanel";
import ReminderListModal from "./ReminderListModal";
import ReminderCreateModal from "./ReminderCreateModal";
import ReminderDetailPanel from "./ReminderDetailPanel";
import { formatApiErrorPayload, readJsonResponse } from "../../lib/fetchClientError";

/** Default metrics when API has not returned yet. */
const EMPTY_METRICS = {
  totalReminders: 0,
  completedReminders: 0,
  pendingReminders: 0,
  cancelledReminders: 0,
  overdueReminders: 0,
  dueToday: 0,
  dueThisWeek: 0
};

/**
 * My Reminders dashboard widget — list, calendar, and reminder modals.
 * @param {{ data?: object, loading?: boolean, lastFetchedAt?: Date | number | null, onRefresh?: () => void }} props
 */
export default function MyRemindersWidget({ data, loading, lastFetchedAt, onRefresh }) {
  const [metrics, setMetrics] = useState(data?.metrics || EMPTY_METRICS);
  const [calendar, setCalendar] = useState(data?.calendar || null);
  const [countsLoading, setCountsLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [listModalOpen, setListModalOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const [selectedDate, setSelectedDate] = useState(null);

  /** Copy metrics and calendar from parent loader payload into local state. */
  const syncFromData = useCallback((payload) => {
    if (!payload) return;
    setMetrics(payload.metrics || EMPTY_METRICS);
    setCalendar(payload.calendar || null);
  }, []);

  /** Fetch fresh summary when parent did not preload metrics. */
  const loadSummary = useCallback(async () => {
    setCountsLoading(true);
    setLocalError("");
    try {
      const res = await fetch("/api/dashboard/my_reminders", { cache: "no-store" });
      const body = await readJsonResponse(res);
      if (!res.ok) {
        setLocalError(formatApiErrorPayload(body, "Failed to load reminder summary"));
        return;
      }
      syncFromData(body);
    } catch {
      setLocalError("Failed to load reminder summary");
    } finally {
      setCountsLoading(false);
    }
  }, [syncFromData]);

  useEffect(() => {
    syncFromData(data);
  }, [data, syncFromData]);

  useEffect(() => {
    if (!data?.metrics) {
      loadSummary();
    }
  }, [data, loadSummary]);

  /** Toolbar refresh — parent cache + local summary + list remount. */
  function handleRefresh() {
    onRefresh?.();
    loadSummary();
    setListRefreshKey((k) => k + 1);
  }

  /** After create modal saves. */
  function handleCreated() {
    handleRefresh();
  }

  /** After detail panel edit. */
  function handleDetailUpdated() {
    handleRefresh();
  }

  /** Toggle calendar date filter for ReminderDashboardList (click same date clears). */
  function handleCalendarDateClick(date) {
    setSelectedDate((prev) => (prev === date ? null : date));
  }

  const isBusy = loading || countsLoading;
  const monthSubtitle = calendar?.monthLabel ? calendar.monthLabel : "Due dates";

  return (
    <>
      <article className="dashboard-widget-card reminder-widget-card reminder-widget-card--compact">
        <DashboardWidgetRefreshHeader
          title="My Reminders"
          lastFetchedAt={lastFetchedAt}
          loading={isBusy}
          onRefresh={handleRefresh}
          actions={
            <>
              <span className="reminder-widget-toolbar-sep" aria-hidden="true" />
              <button type="button" className="reminder-widget-toolbar-btn" onClick={() => setListModalOpen(true)}>
                View all
              </button>
              <button
                type="button"
                className="reminder-widget-toolbar-btn reminder-widget-toolbar-btn--primary"
                onClick={() => setCreateOpen(true)}
              >
                + Add reminder
              </button>
            </>
          }
        />

        {localError ? <p className="reminder-form-error reminder-form-error--inline">{localError}</p> : null}

        <div className="reminder-dash-layout" aria-busy={isBusy}>
          <div className="reminder-dash-col">
            <div className="reminder-dash-panel">
              <div className="reminder-dash-panel-header">
                <DashboardSectionHeader title="Reminders" />
              </div>
              <ReminderDashboardList
                dueDateFilter={selectedDate}
                refreshKey={listRefreshKey}
                onOpenReminder={(r) => setDetailId(r.id)}
              />
            </div>
          </div>

          <div className="reminder-dash-col">
            <div className="reminder-dash-panel reminder-dash-panel--calendar">
              <div className="dashboard-recovery-section-header reminder-dash-section-header--calendar">
                <h4 className="dashboard-recovery-section-title">
                  Due Calendar
                  {monthSubtitle ? <span className="reminder-dash-calendar-month">{monthSubtitle}</span> : null}
                </h4>
              </div>
              <div className="reminder-dash-panel-body reminder-dash-panel-body--calendar">
                <ReminderDueCalendarPanel
                  calendar={calendar}
                  metrics={metrics}
                  selectedDate={selectedDate}
                  onDateClick={handleCalendarDateClick}
                />
              </div>
            </div>
          </div>
        </div>
      </article>

      <ReminderListModal
        open={listModalOpen}
        initialStatus="Pending"
        refreshKey={listRefreshKey}
        onClose={() => setListModalOpen(false)}
        onSelectReminder={(r) => setDetailId(r.id)}
        onAddReminder={() => setCreateOpen(true)}
      />

      <ReminderCreateModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />

      <ReminderDetailPanel
        open={detailId != null}
        reminderId={detailId}
        onClose={() => setDetailId(null)}
        onUpdated={handleDetailUpdated}
      />
    </>
  );
}

