"use client";

// Shared dashboard donut — recovery target vs achieved totals.

/**
 * @param {{ rows: Array<{ recoveryTarget?: number, amountRecovered?: number }>, totals?: { recoveryTarget?: number, amountRecovered?: number, achievedPct?: number } }} props
 */
export default function UnitTargetDonut({ rows = [], totals = null }) {
  const totalTarget =
    totals?.recoveryTarget != null
      ? Number(totals.recoveryTarget)
      : rows.reduce((s, r) => s + Number(r.recoveryTarget || 0), 0);
  const totalAchieved =
    totals?.amountRecovered != null
      ? Number(totals.amountRecovered)
      : rows.reduce((s, r) => s + Number(r.amountRecovered || 0), 0);
  const pct =
    totals?.achievedPct != null
      ? Number(totals.achievedPct)
      : totalTarget > 0
        ? Math.max(0, Math.min(100, (totalAchieved / totalTarget) * 100))
        : 0;

  const r = 48;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  return (
    <div className="dashboard-donut-wrap dashboard-donut-wrap--fluid">
      <svg width="132" height="132" viewBox="0 0 132 132" className="dashboard-donut" aria-hidden="true">
        <circle cx="66" cy="66" r={r} className="dashboard-donut-track" />
        <circle
          cx="66"
          cy="66"
          r={r}
          className="dashboard-donut-fill"
          strokeDasharray={`${dash} ${c - dash}`}
        />
      </svg>
      <div className="dashboard-donut-center">
        <strong>{pct.toFixed(1)}%</strong>
        <span>achieved</span>
      </div>
    </div>
  );
}
