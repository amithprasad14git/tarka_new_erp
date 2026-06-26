"use client";

// Dashboard widget UI — Regional Performance summary KPI cards (panel 1).

/**
 * Three stacked KPI cards: settled cases, cash recovered, NPA reduced.
 * Used inside RegionalPerformanceWidget; data comes from API totals object.
 */

import {
  formatDashboardInrAmount,
  formatInrNumberForDisplay
} from "../../../lib/formatInrNumber";

/**
 * Three KPI cards for Regional Performance panel 1 (settled cases, cash, NPA).
 * @param {{
 *   caseCount?: number,
 *   amountRecovered?: number,
 *   npaReduced?: number
 * }} props
 */
export default function RegionalPerformanceKpis({
  caseCount = 0,
  amountRecovered = 0,
  npaReduced = 0
}) {
  const items = [
    {
      key: "cases",
      label: "Settled Cases",
      value: formatInrNumberForDisplay(caseCount, { integerOnly: true }),
      title: `${caseCount} settled cases`
    },
    {
      key: "recovered",
      label: "Cash Recovered",
      value: formatDashboardInrAmount(amountRecovered),
      title: `Cash recovered: ${formatDashboardInrAmount(amountRecovered)}`
    },
    {
      key: "npa",
      label: "NPA Reduced",
      value: formatDashboardInrAmount(npaReduced),
      title: `NPA reduced: ${formatDashboardInrAmount(npaReduced)}`
    }
  ];

  return (
    <div className="dashboard-kpi-grid dashboard-kpi-grid--regional-performance">
      {items.map((item) => (
        <article
          key={item.key}
          className={`dashboard-kpi-card regional-kpi-card regional-kpi-card--${item.key}`}
          title={item.title}
        >
          <p className="dashboard-kpi-label">{item.label}</p>
          <p className="dashboard-kpi-value">{item.value}</p>
        </article>
      ))}
    </div>
  );
}
