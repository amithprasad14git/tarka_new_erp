"use client";

// Dashboard widget UI — Invoice Collections KPI grid (six clickable tiles).

/**
 * 2×3 KPI grid: Collected %, Pending, Billed, Received, Outstanding, TDS.
 * Each tile opens drilldown modal when onClick handler is provided.
 */

import {
  formatDashboardInrAmount,
  formatInrNumberForDisplay
} from "../../../lib/formatInrNumber";

/** Keyboard Enter/Space activates KPI tile same as click (accessibility). */
function activateOnKey(onActivate) {
  return (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onActivate?.();
    }
  };
}

/**
 * Six clickable KPI tiles for Invoice Collections left panel.
 * @param {{
 *   collectedPct?: number,
 *   pendingCount?: number,
 *   pendingAmount?: number,
 *   billed?: number,
 *   received?: number,
 *   outstanding?: number,
 *   tds?: number,
 *   onCollectedClick?: () => void,
 *   onPendingClick?: () => void,
 *   onBilledClick?: () => void,
 *   onReceivedClick?: () => void,
 *   onOutstandingClick?: () => void,
 *   onTdsClick?: () => void
 * }} props
 */
export default function InvoiceCollectionKpis({
  collectedPct = 0,
  pendingCount = 0,
  pendingAmount = 0,
  billed = 0,
  received = 0,
  outstanding = 0,
  tds = 0,
  onCollectedClick,
  onPendingClick,
  onBilledClick,
  onReceivedClick,
  onOutstandingClick,
  onTdsClick
}) {
  const pctLabel = Number(collectedPct) || 0;

  const items = [
    {
      key: "collected",
      label: "Collected",
      value: `${pctLabel.toFixed(1)}%`,
      title: `${pctLabel.toFixed(1)}% collected`,
      onClick: onCollectedClick
    },
    {
      key: "pending",
      label: "Pending",
      value: formatInrNumberForDisplay(pendingCount, { integerOnly: true }),
      title: `${pendingCount} pending · ${formatDashboardInrAmount(pendingAmount)}`,
      onClick: onPendingClick
    },
    {
      key: "billed",
      label: "Billed",
      value: formatDashboardInrAmount(billed),
      title: `Billed: ${formatDashboardInrAmount(billed)}`,
      onClick: onBilledClick
    },
    {
      key: "received",
      label: "Received",
      value: formatDashboardInrAmount(received),
      title: `Received: ${formatDashboardInrAmount(received)}`,
      onClick: onReceivedClick
    },
    {
      key: "outstanding",
      label: "Outstanding",
      value: formatDashboardInrAmount(outstanding),
      title: `Outstanding: ${formatDashboardInrAmount(outstanding)}`,
      onClick: onOutstandingClick
    },
    {
      key: "tds",
      label: "TDS",
      value: formatDashboardInrAmount(tds),
      title: `TDS: ${formatDashboardInrAmount(tds)}`,
      onClick: onTdsClick
    }
  ];

  return (
    <div className="dashboard-kpi-grid dashboard-kpi-grid--invoice-collections">
      {items.map((item) => (
        <article
          key={item.key}
          className={`dashboard-kpi-card dashboard-chart-clickable invoice-kpi-card invoice-kpi-card--${item.key}`}
          role="button"
          tabIndex={0}
          title={item.title}
          onClick={item.onClick}
          onKeyDown={activateOnKey(item.onClick)}
        >
          <p className="dashboard-kpi-label">{item.label}</p>
          <p className="dashboard-kpi-value">{item.value}</p>
        </article>
      ))}
    </div>
  );
}
