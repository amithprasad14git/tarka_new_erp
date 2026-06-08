"use client";

// KPI strip for Unit Wise Recovery Target dashboard.

import { formatInrNumberForDisplay } from "../../lib/formatInrNumber";

const MAX_STATUS_ROWS = 12;

/**
 * @param {{
 *   recoveredCaseCount?: number,
 *   partRecoveredCaseCount?: number,
 *   caseStatusCounts?: Array<{ statusLabel?: string, caseCount?: number }>,
 *   layout?: "default" | "compact"
 * }} props
 */
export default function RecoveryKpiStrip({
  recoveredCaseCount = 0,
  partRecoveredCaseCount = 0,
  caseStatusCounts = [],
  layout = "default"
}) {
  const gridClass =
    layout === "compact"
      ? "dashboard-kpi-grid dashboard-kpi-grid--recovery dashboard-kpi-grid--recovery-compact"
      : "dashboard-kpi-grid dashboard-kpi-grid--recovery";

  const statusRows = caseStatusCounts.slice(0, MAX_STATUS_ROWS);

  return (
    <div className="dashboard-recovery-kpi-layout">
      <div className={gridClass}>
        <article className="dashboard-kpi-card">
          <p className="dashboard-kpi-label">Recovered cases (FY)</p>
          <p className="dashboard-kpi-value">
            {formatInrNumberForDisplay(recoveredCaseCount, { integerOnly: true })}
          </p>
        </article>
        <article className="dashboard-kpi-card">
          <p className="dashboard-kpi-label">Part-recovered cases</p>
          <p className="dashboard-kpi-value">
            {formatInrNumberForDisplay(partRecoveredCaseCount, { integerOnly: true })}
          </p>
        </article>
      </div>

      <div className="dashboard-recovery-status-section">
        <p className="dashboard-recovery-status-heading">Pending cases on hand</p>
        {statusRows.length ? (
          <div
            className="dashboard-recovery-status-grid"
            style={{ "--status-count": statusRows.length }}
          >
            {statusRows.map((row) => {
              const label = row.statusLabel || "—";
              return (
                <div key={label} className="dashboard-recovery-status-item" title={label}>
                  <span className="dashboard-recovery-status-label">{label}</span>
                  <span className="dashboard-recovery-status-value">
                    {formatInrNumberForDisplay(row.caseCount, { integerOnly: true })}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="dashboard-recovery-status-empty">No pending cases on hand in scope.</p>
        )}
      </div>
    </div>
  );
}
