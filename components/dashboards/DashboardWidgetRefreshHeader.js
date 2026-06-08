"use client";

// Shared dashboard widget header — refresh control and last-updated label (IST).

import { formatDashboardUpdatedAt } from "../../lib/formatDashboardUpdatedAt";

/**
 * @param {{
 *   title: string,
 *   financialYearLabel?: string,
 *   lastFetchedAt?: Date | number | null,
 *   loading?: boolean,
 *   onRefresh: () => void
 * }} props
 */
export default function DashboardWidgetRefreshHeader({
  title,
  financialYearLabel = "",
  lastFetchedAt = null,
  loading = false,
  onRefresh
}) {
  const updatedLabel = formatDashboardUpdatedAt(lastFetchedAt);

  return (
    <div className="dashboard-widget-card-header">
      <div className="dashboard-widget-card-heading">
        <h3 className="dashboard-widget-card-title">{title}</h3>
        {financialYearLabel ? (
          <p className="dashboard-widget-card-subtitle">FY {financialYearLabel}</p>
        ) : null}
      </div>
      <div className="dashboard-widget-refresh-wrap">
        {updatedLabel ? <span className="dashboard-widget-updated">{updatedLabel}</span> : null}
        <button
          type="button"
          className={`dashboard-widget-refresh-btn ${loading ? "is-spinning" : ""}`}
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh dashboard data"
          title="Refresh"
        >
          ↻
        </button>
      </div>
    </div>
  );
}
