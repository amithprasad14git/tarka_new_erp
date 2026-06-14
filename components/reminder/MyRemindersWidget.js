"use client";

import { useCallback, useEffect, useState } from "react";
import DashboardSectionHeader from "../dashboards/DashboardSectionHeader";
import ReminderDashboardList from "./ReminderDashboardList";
import ReminderDueCalendarPanel from "./ReminderDueCalendarPanel";
import ReminderListModal from "./ReminderListModal";
import ReminderCreateModal from "./ReminderCreateModal";
import ReminderDetailPanel from "./ReminderDetailPanel";
import ReminderStatusPills from "./ReminderStatusPills";
import { formatApiErrorPayload, readJsonResponse } from "../../lib/fetchClientError";
import { formatDashboardUpdatedAt } from "../../lib/formatDashboardUpdatedAt";

const EMPTY_METRICS = {
  totalReminders: 0,
  completedReminders: 0,
  pendingReminders: 0,
  cancelledReminders: 0,
  overdueReminders: 0,
  dueToday: 0,
  dueThisWeek: 0
};

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
  const [listStatus, setListStatus] = useState("Pending");

  const syncFromData = useCallback((payload) => {
    if (!payload) return;
    setMetrics(payload.metrics || EMPTY_METRICS);
    setCalendar(payload.calendar || null);
  }, []);

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

  function handleRefresh() {
    onRefresh?.();
    loadSummary();
    setListRefreshKey((k) => k + 1);
  }

  function handleCreated() {
    handleRefresh();
  }

  function handleDetailUpdated() {
    handleRefresh();
  }

  function handleCalendarDateClick(date) {
    setSelectedDate((prev) => (prev === date ? null : date));
  }

  const isBusy = loading || countsLoading;
  const monthSubtitle = calendar?.monthLabel ? calendar.monthLabel : "Due dates";
  const updatedLabel = formatDashboardUpdatedAt(lastFetchedAt);

  return (
    <>
      <article className="dashboard-widget-card reminder-widget-card reminder-widget-card--compact">
        <header className="reminder-widget-header">
          <h3 className="reminder-widget-title">My Reminders</h3>
          <div className="reminder-widget-toolbar">
            {updatedLabel ? <span className="reminder-widget-updated">{updatedLabel}</span> : null}
            <button
              type="button"
              className={`reminder-widget-icon-btn ${isBusy ? "is-spinning" : ""}`}
              onClick={handleRefresh}
              disabled={isBusy}
              aria-label="Refresh reminders"
              title="Refresh"
            >
              ↻
            </button>
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
          </div>
        </header>

        {localError ? <p className="reminder-form-error reminder-form-error--inline">{localError}</p> : null}

        <div className="reminder-dash-layout" aria-busy={isBusy}>
          <div className="reminder-dash-col">
            <div className="reminder-dash-panel">
              <div className="reminder-dash-panel-header">
                <DashboardSectionHeader title="Reminders" />
                <ReminderStatusPills value={listStatus} onChange={setListStatus} showAllOption />
              </div>
              <ReminderDashboardList
                statusFilter={listStatus}
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
                  Due calendar
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
