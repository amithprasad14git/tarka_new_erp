"use client";

import { TASK_STATUS_COLORS } from "./taskUtils";

export function TaskCompletionDonut({ completionRate = 0 }) {
  const pct = Math.max(0, Math.min(100, Number(completionRate) || 0));
  const r = 48;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  return (
    <div className="task-completion-donut-wrap task-completion-donut-wrap--fluid">
      <svg width="132" height="132" viewBox="0 0 132 132" className="task-completion-donut" aria-hidden="true">
        <circle cx="66" cy="66" r={r} className="task-completion-donut-track" />
        <circle
          cx="66"
          cy="66"
          r={r}
          className="task-completion-donut-fill"
          strokeDasharray={`${dash} ${c - dash}`}
        />
      </svg>
      <div className="task-completion-donut-center">
        <strong>{pct.toFixed(1)}%</strong>
        <span>done</span>
      </div>
    </div>
  );
}

const COMPLETION_STAT_ROWS = [
  { status: "Completed", key: "completedTasks", label: "Completed" },
  { status: "In Progress", key: "workInProgress", label: "In progress" },
  { status: "Pending", key: "pendingTasks", label: "Pending" }
];

function CompletionTotalRow({ status, label, value, onStatusClick }) {
  const color = TASK_STATUS_COLORS[status];
  const slug = status.replace(/\s+/g, "-").toLowerCase();
  const count = Number(value) || 0;

  if (onStatusClick) {
    return (
      <button
        type="button"
        className={`task-completion-total-row task-completion-total-row--${slug}`}
        onClick={() => onStatusClick(status)}
      >
        <span className="task-completion-total-label">
          <span className="task-completion-total-dot" style={{ background: color }} aria-hidden="true" />
          {label}
        </span>
        <span className="task-completion-total-value">{count}</span>
      </button>
    );
  }

  return (
    <div className={`task-completion-total-row task-completion-total-row--${slug}`}>
      <span className="task-completion-total-label">
        <span className="task-completion-total-dot" style={{ background: color }} aria-hidden="true" />
        {label}
      </span>
      <span className="task-completion-total-value">{count}</span>
    </div>
  );
}

export function TaskCompletionPanel({ metrics = {}, onStatusClick }) {
  const cancelled = Number(metrics.cancelledTasks) || 0;
  const completionRate = Number(metrics.completionRate) || 0;

  return (
    <div className="task-completion-panel" aria-label="Task completion">
      <div className="task-completion-progress-body">
        <div className="task-completion-chart">
          <TaskCompletionDonut completionRate={completionRate} />
        </div>
        <div className="task-completion-totals">
          {COMPLETION_STAT_ROWS.map(({ status, key, label }) => (
            <CompletionTotalRow
              key={status}
              status={status}
              label={label}
              value={metrics[key]}
              onStatusClick={onStatusClick}
            />
          ))}
          {cancelled > 0 ? (
            <CompletionTotalRow
              key="Cancelled"
              status="Cancelled"
              label="Cancelled"
              value={cancelled}
              onStatusClick={onStatusClick}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

const WORKLOAD_URGENCY = [
  { key: "overdueTasks", label: "Overdue", color: "#dc2626" },
  { key: "dueToday", label: "Due today", color: "#d97706" },
  { key: "dueThisWeek", label: "This week", color: "#8b5cf6" }
];

const WORKLOAD_SECONDARY = [
  { key: "highPriorityOpen", label: "High priority", color: "#ea580c" },
  { key: "finishedLastWeek", label: "Done this week", color: "#16a34a" },
  { key: "activeTasks", label: "Active", color: "#6366f1" }
];

function workloadScaleMax(metrics, keys) {
  const vals = keys.map((k) => Number(metrics[k]) || 0);
  return Math.max(1, ...vals, Number(metrics.totalTasks) || 0);
}

function WorkloadTileRow({ items, metrics }) {
  const scaleMax = workloadScaleMax(
    metrics,
    items.map((x) => x.key)
  );

  return (
    <div className="task-workload-tile-row">
      {items.map(({ key, label, color }) => {
        const value = Number(metrics[key]) || 0;
        const fillPct = Math.min(100, Math.round((value / scaleMax) * 100));
        return (
          <div key={key} className="task-workload-tile" style={{ "--tile-accent": color }}>
            <span className="task-workload-tile-value">{value}</span>
            <span className="task-workload-tile-label">{label}</span>
            <div className="task-workload-tile-track" aria-hidden="true">
              <div
                className="task-workload-tile-fill"
                style={{ width: `${Math.max(value > 0 ? 12 : 0, fillPct)}%`, background: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function TaskWorkloadPanel({ metrics = {} }) {
  const dueSoon =
    (Number(metrics.overdueTasks) || 0) +
    (Number(metrics.dueToday) || 0) +
    (Number(metrics.dueThisWeek) || 0);
  const highPriority = Number(metrics.highPriorityOpen) || 0;

  return (
    <div className="task-workload-panel" aria-label="Task workload">
      <div className="task-workload-body">
        <WorkloadTileRow items={WORKLOAD_URGENCY} metrics={metrics} />
        <WorkloadTileRow items={WORKLOAD_SECONDARY} metrics={metrics} />
      </div>
      <p className="task-workload-footer">
        {dueSoon} due soon · {highPriority} high priority
      </p>
    </div>
  );
}

/** @deprecated use TaskWorkloadPanel */
export function TaskWorkloadBars(props) {
  return <TaskWorkloadPanel metrics={props.metrics} />;
}

export function TaskSummaryStrip({ metrics = {}, openCount = 0 }) {
  const items = [
    { label: "Total", value: metrics.totalTasks, tone: "brand" },
    { label: "Open", value: openCount, tone: "blue" },
    { label: "Active", value: metrics.activeTasks, tone: "violet" },
    { label: "Overdue", value: metrics.overdueTasks, tone: "danger" }
  ];
  return (
    <dl className="task-dash-summary-strip">
      {items.map(({ label, value, tone }) => (
        <div key={label} className={`task-dash-summary-item task-dash-summary-item--${tone}`}>
          <dt>{label}</dt>
          <dd>{Number(value) || 0}</dd>
        </div>
      ))}
    </dl>
  );
}
