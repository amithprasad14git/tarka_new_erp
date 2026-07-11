"use client";

// Dashboard widget UI — Regional Performance region horizontal bars (panel 3).

/**
 * One bar per RBO region showing share of FY cash recovered from settled cases.
 * Parent: RegionalPerformanceWidget.js
 */

import { formatDashboardInrAmount } from "../../../lib/formatInrNumber";

const BAR_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];

/**
 * Horizontal bars — one row per RBO region, width = share of max recovered.
 * @param {{
 *   rows?: Array<{ regionId?: number | string, regionLabel?: string, amountRecovered?: number }>,
 *   emptyMessage?: string
 * }} props
 */
export default function RegionPerformanceBars({
  rows = [],
  emptyMessage = "No regional recovery"
}) {
  const maxAmount = rows.reduce((m, r) => Math.max(m, Number(r.amountRecovered) || 0), 0);

  return (
    <div className="dashboard-bank-bars dashboard-region-bars">
      {rows.length ? (
        <div className="dashboard-bars-list">
          {rows.map((row, i) => {
            const amount = Number(row.amountRecovered) || 0;
            const pct = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
            const label = row.regionLabel || "—";
            const key = row.regionId ?? label ?? i;
            return (
              <div key={key} className="dashboard-bar-row">
                <span className="dashboard-bar-label">{label}</span>
                <div className="dashboard-bar-track">
                  <div
                    className="dashboard-bar-fill"
                    style={{
                      width: `${pct}%`,
                      background: BAR_COLORS[i % BAR_COLORS.length]
                    }}
                  />
                </div>
                <span className="dashboard-bar-value">{formatDashboardInrAmount(amount)}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="dashboard-widget-empty dashboard-widget-empty--inline">{emptyMessage}</p>
      )}
    </div>
  );
}

