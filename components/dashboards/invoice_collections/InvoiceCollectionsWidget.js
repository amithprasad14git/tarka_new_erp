"use client";

// Dashboard widget UI — Invoice Collections (KPI grid + by-bank pie).

/**
 * Landing widget for FY invoice billed vs received. Left: 2×3 KPI grid with drilldown modal.
 * Right: by-bank pie (share of billed). Data: GET /api/dashboard/invoice_collections.
 * Guide: docs/DASHBOARDS.md
 */

import { useState } from "react";
import DashboardWidgetRefreshHeader from "../DashboardWidgetRefreshHeader";
import DashboardSectionHeader from "../DashboardSectionHeader";
import InvoiceCollectionKpis from "./InvoiceCollectionKpis";
import BankRecoveryPie from "../BankRecoveryPie";
import InvoiceCollectionsSummaryModal from "./InvoiceCollectionsSummaryModal";
import "./invoice-collections.css";

/**
 * Invoice Collections landing widget — KPI grid + by-bank pie + drilldown modal.
 * @param {{
 *   data: object,
 *   loading?: boolean,
 *   lastFetchedAt?: Date | number | null,
 *   onRefresh: () => void
 * }} props
 */
export default function InvoiceCollectionsWidget({
  data,
  loading = false,
  lastFetchedAt = null,
  onRefresh
}) {
  const totals = data?.totals || {
    billed: 0,
    received: 0,
    outstanding: 0,
    tds: 0,
    collectedPct: 0
  };
  const pending = data?.pending || { count: 0, amount: 0 };
  const byType = data?.byType || [];
  const byBank = data?.byBank || [];
  const fyLabel = data?.financialYear?.yearRangeLabel || data?.financialYear?.yearCode || "";
  const message = data?.message || "";

  const [modal, setModal] = useState({
    open: false,
    title: "",
    view: "all"
  });

  function openDrilldown({ title, view }) {
    // KPI click opens summary modal with pre-filtered invoice breakdown.
    setModal({ open: true, title, view });
  }

  function closeDrilldown() {
    setModal((m) => ({ ...m, open: false }));
  }

  const hasChartData =
    totals.billed > 0 || totals.received > 0 || byType.length > 0 || byBank.length > 0;

  // Map byBank billed amounts to pie component shape (amountRecovered = billed here).
  const bankPieRows = (() => {
    const totalBilled = byBank.reduce((s, r) => s + (Number(r.billed) || 0), 0);
    return byBank.map((row) => {
      const billed = Number(row.billed) || 0;
      return {
        bankId: row.bankId,
        bankLabel: row.bankLabel,
        amountRecovered: billed,
        achievedPct: totalBilled > 0 ? (billed / totalBilled) * 100 : 0
      };
    });
  })();

  return (
    <>
      <article className="dashboard-widget-card dashboard-widget-card--invoice-collections">
        <DashboardWidgetRefreshHeader
          title="Invoice Collections"
          financialYearLabel={fyLabel}
          lastFetchedAt={lastFetchedAt}
          loading={loading}
          onRefresh={onRefresh}
        />

        <div className="dashboard-invoice-collections-panel">
          {message && !hasChartData ? (
            <p className="dashboard-widget-empty">{message}</p>
          ) : (
            <div className="dashboard-invoice-collections-layout">
              <div className="dashboard-invoice-collections-col">
                <div className="dashboard-recovery-panel">
                  <DashboardSectionHeader title="Collection" subtitle="FY Totals" />
                  <div className="dashboard-recovery-panel-body dashboard-recovery-panel-body--kpis">
                    <InvoiceCollectionKpis
                      collectedPct={totals.collectedPct}
                      pendingCount={pending.count}
                      pendingAmount={pending.amount}
                      billed={totals.billed}
                      received={totals.received}
                      outstanding={totals.outstanding}
                      tds={totals.tds}
                      onCollectedClick={() =>
                        openDrilldown({ title: "Received — FY", view: "received" })
                      }
                      onPendingClick={() =>
                        openDrilldown({ title: "Pending — FY", view: "pending" })
                      }
                      onBilledClick={() =>
                        openDrilldown({ title: "All Invoices — FY", view: "all" })
                      }
                      onReceivedClick={() =>
                        openDrilldown({ title: "Received — FY", view: "received" })
                      }
                      onOutstandingClick={() =>
                        openDrilldown({ title: "Pending — FY", view: "pending" })
                      }
                      onTdsClick={() =>
                        openDrilldown({ title: "Received — FY", view: "received" })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="dashboard-invoice-collections-col">
                <div className="dashboard-recovery-panel">
                  <DashboardSectionHeader title="By Bank" subtitle="Share of FY Billed" />
                  <div className="dashboard-recovery-panel-body dashboard-recovery-panel-body--bank">
                    <BankRecoveryPie
                      rows={bankPieRows}
                      emptyMessage="No invoices in this financial year."
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </article>

      <InvoiceCollectionsSummaryModal
        open={modal.open}
        title={modal.title}
        view={modal.view}
        data={data}
        onClose={closeDrilldown}
      />
    </>
  );
}
