"use client";

import { useCallback, useEffect, useState } from "react";
import DashboardSectionHeader from "../dashboards/DashboardSectionHeader";
import {
  TaskCompletionPanel,
  TaskWorkloadPanel
} from "./TaskDashboardCharts";
import TaskDueCalendarPanel from "./TaskDueCalendarPanel";
import TaskStatusListModal from "./TaskStatusListModal";
import TaskCreateModal from "./TaskCreateModal";
import TaskDetailPanel from "./TaskDetailPanel";
import { formatApiErrorPayload, readJsonResponse } from "../../lib/fetchClientError";
import { formatDashboardUpdatedAt } from "../../lib/formatDashboardUpdatedAt";

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

  const syncFromData = useCallback((payload) => {
    if (!payload?.assignedToMe) return;
    setMetrics(payload.assignedToMe.metrics || EMPTY_METRICS);
    setCalendar(payload.assignedToMe.calendar || null);
    setOpenCount(payload.assignedToMe.openCount || 0);
  }, []);

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

  function handleRefresh() {
    onRefresh?.();
    loadSummary();
  }

  function handleCreated() {
    handleRefresh();
    setListRefreshKey((k) => k + 1);
  }

  function handleDetailUpdated() {
    handleRefresh();
    setListRefreshKey((k) => k + 1);
  }

  const isBusy = loading || countsLoading;
  const monthSubtitle = calendar?.monthLabel ? calendar.monthLabel : "Due dates";
  const updatedLabel = formatDashboardUpdatedAt(lastFetchedAt);

  return (
    <>
      <article className="dashboard-widget-card task-widget-card task-widget-card--compact">
        <header className="task-widget-header">
          <h3 className="task-widget-title">My Tasks</h3>
          <div className="task-widget-toolbar">
            {updatedLabel ? <span className="task-widget-updated">{updatedLabel}</span> : null}
            <button
              type="button"
              className={`task-widget-icon-btn ${isBusy ? "is-spinning" : ""}`}
              onClick={handleRefresh}
              disabled={isBusy}
              aria-label="Refresh tasks"
              title="Refresh"
            >
              ↻
            </button>
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
          </div>
        </header>

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
              <DashboardSectionHeader title="Workload" subtitle="Priority & deadlines" />
              <div className="task-dash-panel-body task-dash-panel-body--workload">
                <TaskWorkloadPanel metrics={metrics} />
              </div>
            </div>
          </div>

          <div className="task-dash-col">
            <div className="task-dash-panel task-dash-panel--calendar">
              <div className="dashboard-recovery-section-header task-dash-section-header--calendar">
                <h4 className="dashboard-recovery-section-title">
                  Due calendar
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
