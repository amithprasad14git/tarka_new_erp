"use client";

// Dashboard widget UI — Unit Wise Recovery Target (full-width four-panel FY recovery).

/**
 * Landing widget: recovery donut + totals | bank pie | KPI strip | month-wise recovery.
 * Recovery amounts use cases settled in active FY (Unit Wise Cumulative rules). Full-width dashboard-recovery-layout.
 * Guide: docs/DASHBOARDS.md
 */

import { formatDashboardInrAmount } from "../../../lib/formatInrNumber";
import UnitTargetDonut from "../UnitTargetDonut";
import BankRecoveryPie from "../BankRecoveryPie";
import DashboardWidgetRefreshHeader from "../DashboardWidgetRefreshHeader";
import DashboardSectionHeader from "../DashboardSectionHeader";
import RecoveryKpiStrip from "../RecoveryKpiStrip";
import MonthWiseRecoveryBars from "../MonthWiseRecoveryBars";

/**
 * Full-width Recovery Target widget — donut, bank pie, KPI strip, month chart.
 * @param {{
 *   data: object,
 *   loading?: boolean,
 *   lastFetchedAt?: Date | number | null,
 *   onRefresh: () => void
 * }} props
 */
export default function UnitWiseRecoveryTargetWidget({
  data,
  loading = false,
  lastFetchedAt = null,
  onRefresh
}) {
  const rows = data?.rows || [];
  const totals = data?.totals || {
    recoveryTarget: 0,
    amountRecovered: 0,
    achievedPct: 0,
    gapToTarget: 0
  };
  const kpis = data?.kpis || {
    gapToTarget: totals.gapToTarget ?? 0,
    recoveredCaseCount: 0,
    partRecoveredCaseCount: 0,
    caseStatusCounts: []
  };
  const monthWiseRecovery = data?.monthWiseRecovery || [];
  const fyLabel = data?.financialYear?.yearRangeLabel || data?.financialYear?.yearCode || "";
  const message = data?.message || "";
  const showMainContent = !message || rows.length > 0 || monthWiseRecovery.length > 0;

  return (
    <article className="dashboard-widget-card dashboard-widget-card--recovery">
      <DashboardWidgetRefreshHeader
        title="Unit Wise Recovery Target"
        financialYearLabel={fyLabel}
        lastFetchedAt={lastFetchedAt}
        loading={loading}
        onRefresh={onRefresh}
      />

      {message && !showMainContent ? (
        <p className="dashboard-widget-empty">{message}</p>
      ) : (
        <div className="dashboard-recovery-layout">
          {/* Panel 1 — FY target vs achieved donut + amount totals */}
          <div className="dashboard-recovery-col dashboard-recovery-col--donut">
            <div className="dashboard-recovery-panel">
              <DashboardSectionHeader title="Recovery Progress" subtitle="Target vs Achieved" />
              <div className="dashboard-recovery-panel-body dashboard-recovery-panel-body--progress">
                <div className="dashboard-recovery-progress-body">
                  <div className="dashboard-recovery-progress-chart">
                    <UnitTargetDonut rows={[]} totals={totals} />
                  </div>
                  <dl className="dashboard-recovery-totals">
                    <div className="dashboard-recovery-total-row">
                      <dt>Target</dt>
                      <dd>{formatDashboardInrAmount(totals.recoveryTarget)}</dd>
                    </div>
                    <div className="dashboard-recovery-total-row">
                      <dt>Achieved</dt>
                      <dd>{formatDashboardInrAmount(totals.amountRecovered)}</dd>
                    </div>
                    <div className="dashboard-recovery-total-row">
                      <dt>Gap to Target</dt>
                      <dd>{formatDashboardInrAmount(totals.gapToTarget)}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </div>
          {/* Panel 2 — share of recovery by bank (pie chart) */}
          <div className="dashboard-recovery-col dashboard-recovery-col--bank">
            <div className="dashboard-recovery-panel">
              <DashboardSectionHeader title="Bank Wise Recovery" subtitle="Share of FY Recovery" />
              <div className="dashboard-recovery-panel-body dashboard-recovery-panel-body--bank">
                <BankRecoveryPie rows={rows} />
              </div>
            </div>
          </div>
          {/* Panel 3 — case counts and status KPI strip */}
          <div className="dashboard-recovery-col dashboard-recovery-col--kpis">
            <div className="dashboard-recovery-panel dashboard-recovery-panel--kpis">
              <DashboardSectionHeader title="Recovery KPIs" subtitle="Current Financial Year" />
              <div className="dashboard-recovery-panel-body dashboard-recovery-panel-body--kpis">
                <RecoveryKpiStrip
                  layout="compact"
                  recoveredCaseCount={kpis.recoveredCaseCount}
                  partRecoveredCaseCount={kpis.partRecoveredCaseCount}
                  caseStatusCounts={kpis.caseStatusCounts}
                />
              </div>
            </div>
          </div>
          {/* Panel 4 — month-by-month recovery trend bars */}
          <div className="dashboard-recovery-col dashboard-recovery-col--months">
            <div className="dashboard-recovery-panel">
              <DashboardSectionHeader title="Month Wise Recovery" subtitle="Trend by Month" />
              <div className="dashboard-recovery-panel-body dashboard-recovery-panel-body--months">
                <MonthWiseRecoveryBars rows={monthWiseRecovery} variant="inline" hideHeading />
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
