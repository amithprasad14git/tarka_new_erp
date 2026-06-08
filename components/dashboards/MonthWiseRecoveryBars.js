"use client";

// Month-wise recovery column chart for dashboard widgets (active FY).

import {
  formatDashboardInrAmountShort,
  formatReportAmountForDisplay
} from "../../lib/formatInrNumber";

/**
 * @param {string} monthLabel
 * @param {string} monthKey
 */
function shortMonthLabel(monthLabel, monthKey) {
  if (monthLabel) {
    const part = monthLabel.split("-")[0]?.trim();
    if (part) return part;
  }
  if (monthKey && /^\d{4}-\d{2}$/.test(monthKey)) {
    const d = new Date(`${monthKey}-01T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString("en-IN", { month: "short" });
    }
  }
  return monthLabel || monthKey || "—";
}

/**
 * @param {{
 *   rows?: Array<{ monthKey?: string, monthLabel?: string, amountRecovered?: number }>,
 *   title?: string,
 *   variant?: "default" | "inline",
 *   hideHeading?: boolean
 * }} props
 */
export default function MonthWiseRecoveryBars({
  rows = [],
  title = "Month wise recovery (FY)",
  variant = "default",
  hideHeading = false
}) {
  const maxAmount = rows.reduce((m, r) => Math.max(m, Number(r.amountRecovered) || 0), 0);
  const isInline = variant === "inline";
  const yTicks = maxAmount > 0 ? [maxAmount, maxAmount / 2, 0] : [0];

  const rootClass = isInline
    ? "dashboard-month-recovery dashboard-month-recovery--inline"
    : "dashboard-month-recovery";

  const chartClass = isInline
    ? "dashboard-month-chart dashboard-month-chart--fill dashboard-month-chart--minimal"
    : "dashboard-month-chart";

  return (
    <div className={rootClass}>
      {!hideHeading ? <p className="dashboard-bars-heading">{title}</p> : null}
      {rows.length ? (
        <div className={isInline ? "dashboard-month-chart-wrap dashboard-month-chart-wrap--minimal" : "dashboard-month-chart-wrap"}>
          {!isInline ? (
            <div className="dashboard-month-y-axis" aria-hidden="true">
              {yTicks.map((tick, i) => (
                <span
                  key={`${tick}-${i}`}
                  className="dashboard-month-y-tick"
                  title={formatReportAmountForDisplay(tick)}
                >
                  {formatDashboardInrAmountShort(tick)}
                </span>
              ))}
            </div>
          ) : null}
          <div className="dashboard-month-plot">
            <div className={isInline ? "dashboard-month-chart-area dashboard-month-chart-area--minimal" : "dashboard-month-chart-area"}>
              <div className={chartClass} role="img" aria-label="Month-wise recovery trend">
                {rows.map((r) => {
                  const amount = Number(r.amountRecovered) || 0;
                  const pct = maxAmount > 0 ? Math.max(3, (amount / maxAmount) * 100) : 0;
                  const fullLabel = r.monthLabel || r.monthKey || "—";
                  const amountLabel = formatReportAmountForDisplay(amount);
                  return (
                    <div
                      key={r.monthKey || fullLabel}
                      className="dashboard-month-col"
                      title={`${fullLabel}: ${amountLabel}`}
                      aria-label={`${fullLabel}: ${amountLabel}`}
                    >
                      <span className="dashboard-month-bar-value">
                        {formatDashboardInrAmountShort(amount)}
                      </span>
                      <div
                        className="dashboard-month-bar-fill"
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="dashboard-month-x-labels">
                {rows.map((r) => {
                  const fullLabel = r.monthLabel || r.monthKey || "—";
                  const label = shortMonthLabel(fullLabel, r.monthKey || "");
                  return (
                    <span key={r.monthKey || fullLabel} className="dashboard-month-label">
                      {label}
                    </span>
                  );
                })}
              </div>
            </div>
            {!isInline ? (
              <div className="dashboard-month-chart-footer">
                <span className="dashboard-month-legend">
                  <span className="dashboard-month-legend-swatch" aria-hidden="true" />
                  Recovery amount
                </span>
                <span className="dashboard-month-x-axis-title">Month</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="dashboard-widget-empty dashboard-widget-empty--inline">
          No month-wise recovery in this financial year.
        </p>
      )}
    </div>
  );
}
