"use client";

// Dashboard drilldown — Invoice Collections KPI summary modal (opens from KPI clicks).

/**
 * Full-screen modal when user clicks a KPI tile on Invoice Collections widget.
 * Shows extra KPIs + chart for the selected view (received, pending, all, or by type).
 * Footer links to Invoice Ledger or Invoices Received Ledger report.
 * Parent: InvoiceCollectionsWidget.js — data is already loaded (no extra API call).
 * Guide: docs/DASHBOARDS.md
 */

import { useEffect } from "react";
import Link from "next/link";
import MonthWiseRecoveryBars from "../MonthWiseRecoveryBars";
import {
  formatDashboardInrAmount,
  formatInrNumberForDisplay,
  formatReportAmountForDisplay
} from "../../../lib/formatInrNumber";
import InvoiceCollectionsModalPortal from "./InvoiceCollectionsModalPortal";
import "./invoice-collections.css";

/**
 * Percentage collected for one invoice type row (received ÷ billed).
 * @param {number} billed
 * @param {number} received
 */
function collectedPct(billed, received) {
  const b = Number(billed);
  const r = Number(received);
  if (!Number.isFinite(b) || b <= 0) return 0;
  if (!Number.isFinite(r) || r <= 0) return 0;
  return Math.max(0, Math.min(100, (r / b) * 100));
}

const TYPE_COLORS = {
  Recovery: "var(--brand)",
  SARFAESI: "#3b82f6",
  Vehicle: "#f59e0b"
};

const FALLBACK_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#8b5cf6"];

const TYPE_KEYS = new Set(["recovery", "sarfaesi", "vehicle"]);

/**
 * True when view is a single invoice type (recovery / sarfaesi / vehicle).
 * @param {string} view
 */
function isTypeView(view) {
  return TYPE_KEYS.has(String(view || "").toLowerCase());
}

/**
 * Report link in modal footer — ledger vs received ledger depending on view.
 * @param {string} view
 */
function reportLinkForView(view) {
  if (String(view || "").toLowerCase() === "received") {
    return {
      href: "/dashboard/report_invoices_received_ledger",
      label: "Open in Invoices Received Ledger"
    };
  }
  return {
    href: "/dashboard/report_invoice_ledger",
    label: "Open in Invoice Ledger"
  };
}

/**
 * Human-readable label for modal subtitle (matches KPI drilldown view key).
 * @param {string} view
 */
function viewLabel(view) {
  const v = String(view || "all").toLowerCase();
  if (v === "received") return "Received";
  if (v === "pending") return "Pending";
  if (v === "all") return "All Invoices";
  if (v === "recovery") return "Recovery";
  if (v === "sarfaesi") return "SARFAESI";
  if (v === "vehicle") return "Vehicle";
  return v;
}

/**
 * Find one row in byType array by typeKey (case-insensitive).
 * @param {Array<{ typeKey?: string, typeLabel?: string, billed?: number, received?: number }>} byType
 * @param {string} typeKey
 */
function findTypeRow(byType, typeKey) {
  return byType.find((r) => String(r.typeKey).toLowerCase() === String(typeKey).toLowerCase()) || null;
}

/**
 * Horizontal bars for type breakdown inside the modal (billed or outstanding amounts).
 * @param {{
 *   rows: Array<{ typeLabel?: string, amount?: number, color?: string }>,
 *   title?: string
 * }} props
 */
function TypeAmountBars({ rows = [], title = "By Type" }) {
  const maxAmount = rows.reduce((m, r) => Math.max(m, Number(r.amount) || 0), 0);

  return (
    <div className="dashboard-bank-bars invoice-collections-summary-bars">
      {title ? <p className="dashboard-bars-heading">{title}</p> : null}
      {rows.length ? (
        <div className="dashboard-bars-list">
          {rows.map((row) => {
            const amount = Number(row.amount) || 0;
            const pct = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
            const label = row.typeLabel || "—";
            return (
              <div key={label} className="dashboard-bar-row">
                <span className="dashboard-bar-label">{label}</span>
                <div className="dashboard-bar-track">
                  <div
                    className="dashboard-bar-fill"
                    style={{
                      width: `${pct}%`,
                      background: row.color || undefined
                    }}
                  />
                </div>
                <span className="dashboard-bar-value">{formatReportAmountForDisplay(amount)}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="dashboard-widget-empty dashboard-widget-empty--inline">No data for this view.</p>
      )}
    </div>
  );
}

/**
 * Invoice Collections drilldown modal — content depends on `view` prop from KPI click.
 * @param {{
 *   open: boolean,
 *   title: string,
 *   view: string,
 *   data?: object,
 *   onClose: () => void
 * }} props
 */
export default function InvoiceCollectionsSummaryModal({
  open,
  title,
  view,
  data = {},
  onClose
}) {
  // Close on Escape key while modal is open.
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const totals = data?.totals || {};
  const pending = data?.pending || {};
  const byType = data?.byType || [];
  const counts = data?.counts || {};
  const monthWiseReceived = data?.monthWiseReceived || [];
  const fyLabel = data?.financialYear?.yearRangeLabel || data?.financialYear?.yearCode || "";
  const normalizedView = String(view || "all").toLowerCase();
  const reportLink = reportLinkForView(normalizedView);

  // Build KPI cards + chart based on which KPI the user clicked.
  let kpiCards = [];
  let chart = null;

  if (normalizedView === "received") {
    // Received KPI — show cash in, TDS, collection %, month-wise received chart.
    kpiCards = [
      { label: "Received", value: formatDashboardInrAmount(totals.received) },
      { label: "TDS", value: formatDashboardInrAmount(totals.tds) },
      { label: "Collected", value: `${(Number(totals.collectedPct) || 0).toFixed(1)}%` }
    ];
    chart = (
      <MonthWiseRecoveryBars
        rows={monthWiseReceived}
        title="Month-Wise Received (FY)"
        variant="inline"
        hideBarValues
      />
    );
  } else if (normalizedView === "pending") {
    // Pending KPI — unpaid invoice count/amount + outstanding by type bars.
    kpiCards = [
      {
        label: "Pending Count",
        value: formatInrNumberForDisplay(pending.count, { integerOnly: true })
      },
      { label: "Pending Amount", value: formatDashboardInrAmount(pending.amount) }
    ];
    const outstandingRows = byType
      .map((row, i) => ({
        typeLabel: row.typeLabel || row.typeKey,
        amount: Math.max(0, (Number(row.billed) || 0) - (Number(row.received) || 0)),
        color: TYPE_COLORS[row.typeLabel] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]
      }))
      .filter((r) => r.amount > 0);
    chart = <TypeAmountBars rows={outstandingRows} title="Outstanding by Type" />;
  } else if (normalizedView === "all") {
    // Billed KPI — total FY billed + invoice count + billed-by-type bars.
    kpiCards = [
      { label: "FY Billed", value: formatDashboardInrAmount(totals.billed) },
      {
        label: "Invoice Count",
        value: formatInrNumberForDisplay(counts.billed, { integerOnly: true })
      }
    ];
    const billedRows = byType
      .map((row, i) => ({
        typeLabel: row.typeLabel || row.typeKey,
        amount: Number(row.billed) || 0,
        color: TYPE_COLORS[row.typeLabel] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]
      }))
      .filter((r) => r.amount > 0);
    chart = <TypeAmountBars rows={billedRows} title="Billed by Type" />;
  } else if (isTypeView(normalizedView)) {
    // Single invoice type drilldown (recovery / sarfaesi / vehicle).
    const typeRow = findTypeRow(byType, normalizedView);
    const typeBilled = Number(typeRow?.billed) || 0;
    const typeReceived = Number(typeRow?.received) || 0;
    const typeOutstanding = Math.max(0, typeBilled - typeReceived);
    const typePct = collectedPct(typeBilled, typeReceived);
    kpiCards = [
      { label: "Billed", value: formatDashboardInrAmount(typeBilled) },
      { label: "Received", value: formatDashboardInrAmount(typeReceived) },
      { label: "Outstanding", value: formatDashboardInrAmount(typeOutstanding) },
      { label: "Collected", value: `${typePct.toFixed(1)}%` }
    ];
  }

  return (
    <InvoiceCollectionsModalPortal>
      <div
        className="invoice-collections-modal-backdrop"
        role="presentation"
        onClick={(e) => {
          // Click outside dialog closes modal.
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="invoice-collections-modal invoice-collections-summary-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invoice-collections-summary-title"
        >
          <header className="invoice-collections-modal-header">
            <div>
              <h2 id="invoice-collections-summary-title" className="invoice-collections-modal-title">
                {title}
              </h2>
              <p className="invoice-collections-modal-subtitle">
                {fyLabel ? `FY ${fyLabel}` : "Active FY"}
                {viewLabel(normalizedView) ? ` · ${viewLabel(normalizedView)}` : ""}
              </p>
            </div>
            <button
              type="button"
              className="invoice-collections-modal-close"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </header>

          <div className="invoice-collections-modal-body invoice-collections-summary-body">
            {kpiCards.length ? (
              <div className="invoice-collections-summary-kpis">
                {kpiCards.map((card) => (
                  <article key={card.label} className="dashboard-kpi-card">
                    <p className="dashboard-kpi-label">{card.label}</p>
                    <p className="dashboard-kpi-value">{card.value}</p>
                  </article>
                ))}
              </div>
            ) : null}
            {chart}
          </div>

          <footer className="invoice-collections-modal-footer invoice-collections-summary-footer">
            <Link href={reportLink.href} className="invoice-collections-summary-report-link">
              {reportLink.label}
            </Link>
          </footer>
        </div>
      </div>
    </InvoiceCollectionsModalPortal>
  );
}
