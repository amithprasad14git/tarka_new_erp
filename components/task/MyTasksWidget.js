"use client";

// Dashboard widget UI — My Tasks (completion, workload, calendar + modals).

/**
 * Landing widget for tasks assigned to the logged-in user.
 * Three panels: completion donut (click status → list modal), workload tiles, due calendar.
 * Modals: TaskStatusListModal (view all / status drilldown), TaskCreateModal, TaskDetailPanel.
 * Data: parent cache via DashboardWidgetLoader; falls back to GET /api/dashboard/my_tasks.
 * Guide: docs/DASHBOARDS.md
 */

import { useCallback, useEffect, useState } from "react";
import DashboardSectionHeader from "../dashboards/DashboardSectionHeader";
import DashboardWidgetRefreshHeader from "../dashboards/DashboardWidgetRefreshHeader";
import {
  TaskCompletionPanel,
  TaskWorkloadPanel
} from "./TaskDashboardCharts";
import TaskDueCalendarPanel from "./TaskDueCalendarPanel";
import TaskStatusListModal from "./TaskStatusListModal";
import TaskCreateModal from "./TaskCreateModal";
import TaskDetailPanel from "./TaskDetailPanel";
import { formatApiErrorPayload, readJsonResponse } from "../../lib/fetchClientError";

/** Default metrics when API has not returned yet. */
const EMPTY_METRICS = {
  totalTasks: 0,
  completedTasks: 0,
  workInProgress: 0,
  pendingTasks: 0,
  overdueTasks: 0,
  dueToday: 0,
  dueThisWeek: 0,
  highPriorityOpen: 0,
  cancelledTasks: 0,
  finishedLastWeek: 0,
  completionRate: 0,
  activeTasks: 0,
  inProgressRate: 0
};

/**
 * My Tasks dashboard widget — orchestrates panels and task modals.
 * @param {{ data?: object, loading?: boolean, lastFetchedAt?: Date | number | null, onRefresh?: () => void }} props
 */
export default function MyTasksWidget({ data, loading, lastFetchedAt, onRefresh }) {
  const [metrics, setMetrics] = useState(data?.assignedToMe?.metrics || EMPTY_METRICS);
  const [calendar, setCalendar] = useState(data?.assignedToMe?.calendar || null);
  const [openCount, setOpenCount] = useState(data?.assignedToMe?.openCount || 0);
  const [countsLoading, setCountsLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [listModalStatus, setListModalStatus] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [listRefreshKey, setListRefreshKey] = useState(0);

  /** Copy metrics/calendar/openCount from parent loader payload into local state. */
  const syncFromData = useCallback((payload) => {
    if (!payload?.assignedToMe) return;
    setMetrics(payload.assignedToMe.metrics || EMPTY_METRICS);
    setCalendar(payload.assignedToMe.calendar || null);
    setOpenCount(payload.assignedToMe.openCount || 0);
  }, []);

  /** Fetch fresh summary when parent did not preload assignedToMe metrics. */
  const loadSummary = useCallback(async () => {
    setCountsLoading(true);
    setLocalError("");
    try {
      const res = await fetch("/api/dashboard/my_tasks", { cache: "no-store" });
      const body = await readJsonResponse(res);
      if (!res.ok) {
        setLocalError(formatApiErrorPayload(body, "Failed to load task summary"));
        return;
      }
      syncFromData(body);
    } catch {
      setLocalError("Failed to load task summary");
    } finally {
      setCountsLoading(false);
    }
  }, [syncFromData]);

  useEffect(() => {
    syncFromData(data);
  }, [data, syncFromData]);

  useEffect(() => {
    if (!data?.assignedToMe?.metrics) {
      loadSummary();
    }
  }, [data, loadSummary]);

  /** Toolbar refresh — tell parent to reload cache and refetch local summary. */
  function handleRefresh() {
    onRefresh?.();
    loadSummary();
  }

  /** After create modal saves — refresh counts and force list modal to reload. */
  function handleCreated() {
    handleRefresh();
    setListRefreshKey((k) => k + 1);
  }

  /** After detail panel edit — same as handleCreated. */
  function handleDetailUpdated() {
    handleRefresh();
    setListRefreshKey((k) => k + 1);
  }

  const isBusy = loading || countsLoading;
  const monthSubtitle = calendar?.monthLabel ? calendar.monthLabel : "Due dates";

  return (
    <>
      <article className="dashboard-widget-card task-widget-card task-widget-card--compact">
        <DashboardWidgetRefreshHeader
          title="My Tasks"
          lastFetchedAt={lastFetchedAt}
          loading={isBusy}
          onRefresh={handleRefresh}
          actions={
            <>
              <span className="task-widget-toolbar-sep" aria-hidden="true" />
              <button
                type="button"
                className="task-widget-toolbar-btn"
                onClick={() => setListModalStatus("Pending")}
              >
                View all
              </button>
              <button
                type="button"
                className="task-widget-toolbar-btn task-widget-toolbar-btn--primary"
                onClick={() => setCreateOpen(true)}
              >
                + Add task
              </button>
            </>
          }
        />

        {localError ? <p className="task-form-error task-form-error--inline">{localError}</p> : null}

        <div className="task-dash-layout" aria-busy={isBusy}>
          <div className="task-dash-col">
            <div className="task-dash-panel task-dash-panel--completion">
              <DashboardSectionHeader title="Completion" />
              <div className="task-dash-panel-body task-dash-panel-body--progress">
                <TaskCompletionPanel
                  metrics={metrics}
                  onStatusClick={setListModalStatus}
                />
              </div>
            </div>
          </div>

          <div className="task-dash-col task-dash-col--wide">
            <div className="task-dash-panel">
              <DashboardSectionHeader title="Workload" subtitle="Priority & Deadlines" />
              <div className="task-dash-panel-body task-dash-panel-body--workload">
                <TaskWorkloadPanel metrics={metrics} />
              </div>
            </div>
          </div>

          <div className="task-dash-col">
            <div className="task-dash-panel task-dash-panel--calendar">
              <div className="dashboard-recovery-section-header task-dash-section-header--calendar">
                <h4 className="dashboard-recovery-section-title">
                  Due Calendar
                  {monthSubtitle ? <span className="task-dash-calendar-month">{monthSubtitle}</span> : null}
                </h4>
              </div>
              <div className="task-dash-panel-body task-dash-panel-body--calendar">
                <TaskDueCalendarPanel calendar={calendar} metrics={metrics} />
              </div>
            </div>
          </div>
        </div>
      </article>

      <TaskStatusListModal
        open={listModalStatus != null}
        initialStatus={listModalStatus}
        refreshKey={listRefreshKey}
        onClose={() => setListModalStatus(null)}
        onSelectTask={(task) => setDetailId(task.id)}
        onAddTask={() => setCreateOpen(true)}
      />

      <TaskCreateModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />

      <TaskDetailPanel
        open={detailId != null}
        taskId={detailId}
        onClose={() => setDetailId(null)}
        onUpdated={handleDetailUpdated}
      />
    </>
  );
}
