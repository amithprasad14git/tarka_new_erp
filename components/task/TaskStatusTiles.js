"use client";

import { TASK_STATUSES } from "./taskUtils";

const STATUS_ACCENT = {
  Pending: "task-kpi-tile--pending",
  "In Progress": "task-kpi-tile--progress",
  Completed: "task-kpi-tile--completed",
  Cancelled: "task-kpi-tile--cancelled"
};

export default function TaskStatusTiles({ statuses, statusCounts, onSelectStatus }) {
  const list = statuses?.length ? statuses : TASK_STATUSES;
  return (
    <div className="dashboard-kpi-grid task-kpi-grid">
      {list.map((st) => {
        const count = Number(statusCounts?.[st]) || 0;
        const accent = STATUS_ACCENT[st] || "task-kpi-tile--pending";
        return (
          <button
            key={st}
            type="button"
            className={`dashboard-kpi-card task-kpi-tile ${accent}`}
            onClick={() => onSelectStatus?.(st)}
          >
            <p className="dashboard-kpi-label">{st}</p>
            <p className="dashboard-kpi-value">{count}</p>
          </button>
        );
      })}
    </div>
  );
}
