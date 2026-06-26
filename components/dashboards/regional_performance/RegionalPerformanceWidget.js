"use client";

// Dashboard widget UI — Regional Performance (full-width four-panel FY settled summary).

/**
 * Landing widget: Summary KPIs | loan type pie | region bars | month-wise settled.
 * Data from GET /api/dashboard/regional_performance (see lib/dashboards/regional_performance/).
 * Layout reuses dashboard-recovery-layout (same grid as Unit Wise Recovery Target).
 * Guide: docs/DASHBOARDS.md
 */

import DashboardWidgetRefreshHeader from "../DashboardWidgetRefreshHeader";
import DashboardSectionHeader from "../DashboardSectionHeader";
import BankRecoveryPie from "../BankRecoveryPie";
import MonthWiseRecoveryBars from "../MonthWiseRecoveryBars";
import RegionalPerformanceKpis from "./RegionalPerformanceKpis";
import RegionPerformanceBars from "./RegionPerformanceBars";

/**
 * Full-width Regional Performance widget — four panels from API payload.
 * @param {{
 *   data: object,
 *   loading?: boolean,
 *   lastFetchedAt?: Date | number | null,
 *   onRefresh: () => void
 * }} props
 */
export default function RegionalPerformanceWidget({
  data,
  loading = false,
  lastFetchedAt = null,
  onRefresh
}) {
  const totals = data?.totals || { caseCount: 0, amountRecovered: 0, npaReduced: 0 };
  const byLoanType = data?.byLoanType || [];
  const byRegion = data?.byRegion || [];
  const monthWiseSettled = data?.monthWiseSettled || [];
  const fyLabel = data?.financialYear?.yearRangeLabel || data?.financialYear?.yearCode || "";
  const message = data?.message || "";

  const hasChartData =
    totals.caseCount > 0 ||
    totals.amountRecovered > 0 ||
    byLoanType.length > 0 ||
    byRegion.length > 0 ||
    monthWiseSettled.length > 0;

  // BankRecoveryPie expects bankId/bankLabel — map loan type rows to that shape.
  const loanPieRows = (() => {
    const totalRecovered = byLoanType.reduce((s, r) => s + (Number(r.amountRecovered) || 0), 0);
    return byLoanType.map((row) => {
      const amount = Number(row.amountRecovered) || 0;
      return {
        bankId: row.loanTypeId,
        bankLabel: row.loanTypeLabel,
        amountRecovered: amount,
        achievedPct: totalRecovered > 0 ? (amount / totalRecovered) * 100 : 0
      };
    });
  })();

  return (
    <article className="dashboard-widget-card dashboard-widget-card--regional">
      <DashboardWidgetRefreshHeader
        title="Regional Performance"
        financialYearLabel={fyLabel}
        lastFetchedAt={lastFetchedAt}
        loading={loading}
        onRefresh={onRefresh}
      />

      {message && !hasChartData ? (
        <p className="dashboard-widget-empty">{message}</p>
      ) : (
        <div className="dashboard-recovery-layout">
          {/* Panel 1 — settled case count, cash recovered, NPA reduced KPIs */}
          <div className="dashboard-recovery-col dashboard-recovery-col--kpis">
            <div className="dashboard-recovery-panel dashboard-recovery-panel--kpis">
              <DashboardSectionHeader title="Summary" subtitle="FY Settled" />
              <div className="dashboard-recovery-panel-body dashboard-recovery-panel-body--kpis">
                <RegionalPerformanceKpis
                  caseCount={totals.caseCount}
                  amountRecovered={totals.amountRecovered}
                  npaReduced={totals.npaReduced}
                />
              </div>
            </div>
          </div>

          {/* Panel 2 — share of recovery by loan type (pie chart) */}
          <div className="dashboard-recovery-col dashboard-recovery-col--bank">
            <div className="dashboard-recovery-panel">
              <DashboardSectionHeader title="By Loan Type" subtitle="Share of Cash Recovered" />
              <div className="dashboard-recovery-panel-body dashboard-recovery-panel-body--bank">
                <BankRecoveryPie
                  rows={loanPieRows}
                  emptyMessage="No settled cases in this financial year."
                />
              </div>
            </div>
          </div>

          {/* Panel 3 — horizontal bars by RBO region */}
          <div className="dashboard-recovery-col dashboard-recovery-col--donut">
            <div className="dashboard-recovery-panel">
              <DashboardSectionHeader title="By Region" subtitle="RBO Cash Recovered" />
              <div className="dashboard-recovery-panel-body dashboard-recovery-panel-body--region">
                <RegionPerformanceBars rows={byRegion} />
              </div>
            </div>
          </div>

          {/* Panel 4 — month-by-month settled case trend */}
          <div className="dashboard-recovery-col dashboard-recovery-col--months">
            <div className="dashboard-recovery-panel">
              <DashboardSectionHeader title="Month-Wise Settled" subtitle="Settlement Timing (FY)" />
              <div className="dashboard-recovery-panel-body dashboard-recovery-panel-body--months">
                <MonthWiseRecoveryBars rows={monthWiseSettled} variant="inline" hideHeading />
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
