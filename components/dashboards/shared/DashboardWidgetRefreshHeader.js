"use client";

// Shared dashboard widget header — title, FY subtitle, last updated, refresh.

/**
 * Top bar for every landing widget: title, optional "FY Apr … – Mar …",
 * "Updated 10:42 AM" (IST), and Refresh button. Optional actions slot for Tasks/Reminders.
 */

import { formatDashboardUpdatedAt } from "../../../lib/formatDashboardUpdatedAt";

/**
 * Widget title row with optional FY label, last-updated time, and Refresh button.
 * @param {{
 *   title: string,
 *   financialYearLabel?: string,
 *   lastFetchedAt?: Date | number | null,
 *   loading?: boolean,
 *   onRefresh?: () => void,
 *   variant?: "default" | "compact",
 *   showRefresh?: boolean,
 *   actions?: import("react").ReactNode
 * }} props
 */
export default function DashboardWidgetRefreshHeader({
  title,
  financialYearLabel = "",
  lastFetchedAt = null,
  loading = false,
  onRefresh,
  variant = "default",
  showRefresh = true,
  actions = null
}) {
  const updatedLabel = formatDashboardUpdatedAt(lastFetchedAt);
  const isCompact = variant === "compact";

  return (
    <div
      className={`dashboard-widget-card-header${isCompact ? " dashboard-widget-card-header--compact" : ""}`}
    >
      <div className="dashboard-widget-card-heading">
        <h3 className="dashboard-widget-card-title">
          {title}
          {isCompact && financialYearLabel ? (
            <span className="dashboard-widget-card-fy-inline"> · FY {financialYearLabel}</span>
          ) : null}
        </h3>
        {!isCompact && financialYearLabel ? (
          <p className="dashboard-widget-card-subtitle">FY {financialYearLabel}</p>
        ) : null}
      </div>
      <div className="dashboard-widget-refresh-wrap">
        {!isCompact && updatedLabel ? (
          <span className="dashboard-widget-updated">{updatedLabel}</span>
        ) : null}
        {showRefresh ? (
          <button
            type="button"
            className={`dashboard-widget-refresh-btn ${loading ? "is-spinning" : ""}`}
            onClick={onRefresh}
            disabled={loading}
            aria-label="Refresh dashboard data"
            title={updatedLabel ? `Refresh (${updatedLabel})` : "Refresh"}
          >
            ↻
          </button>
        ) : null}
        {actions}
      </div>
    </div>
  );
}

