"use client";

// Compact bank-wise recovery pie for Unit Wise Recovery Target dashboard.

import { formatReportAmountForDisplay } from "../../lib/formatInrNumber";

const SLICE_COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];

/**
 * @param {number} cx
 * @param {number} cy
 * @param {number} r
 * @param {number} angleDeg
 */
function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * @param {number} cx
 * @param {number} cy
 * @param {number} r
 * @param {number} startAngle
 * @param {number} endAngle
 */
function describeSlicePath(cx, cy, r, startAngle, endAngle) {
  if (endAngle - startAngle >= 359.99) {
    return null;
  }
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    "M",
    cx,
    cy,
    "L",
    start.x,
    start.y,
    "A",
    r,
    r,
    0,
    largeArc,
    0,
    end.x,
    end.y,
    "Z"
  ].join(" ");
}

/**
 * @param {{
 *   rows?: Array<{ bankId?: number | string, bankLabel?: string, amountRecovered?: number, achievedPct?: number }>
 * }} props
 */
export default function BankRecoveryPie({ rows = [] }) {
  const total = rows.reduce((s, r) => s + (Number(r.amountRecovered) || 0), 0);
  const cx = 64;
  const cy = 64;
  const r = 50;
  const size = 128;

  let angle = 0;
  const slices = rows.map((row, i) => {
    const amount = Number(row.amountRecovered) || 0;
    const sliceAngle = total > 0 ? (amount / total) * 360 : 0;
    const startAngle = angle;
    angle += sliceAngle;
    return {
      bankId: row.bankId ?? i,
      bankLabel: row.bankLabel || "—",
      amount,
      achievedPct: Number(row.achievedPct) || 0,
      startAngle,
      endAngle: angle,
      color: SLICE_COLORS[i % SLICE_COLORS.length],
      fullCircle: sliceAngle >= 359.99
    };
  });

  const hasData = rows.length > 0 && total > 0;

  return (
    <div className="dashboard-bank-pie-wrap">
      {hasData ? (
        <div className="dashboard-bank-pie-body">
          <div className="dashboard-bank-pie-chart">
            <svg
              viewBox={`0 0 ${size} ${size}`}
              className="dashboard-bank-pie dashboard-bank-pie-svg"
              aria-hidden="true"
            >
              {slices.map((s) =>
                s.fullCircle ? (
                  <circle key={s.bankId} cx={cx} cy={cy} r={r} fill={s.color} className="dashboard-bank-pie-slice" />
                ) : (
                  <path
                    key={s.bankId}
                    d={describeSlicePath(cx, cy, r, s.startAngle, s.endAngle) || undefined}
                    fill={s.color}
                    className="dashboard-bank-pie-slice"
                  />
                )
              )}
            </svg>
          </div>
          <ul className="dashboard-bank-pie-legend">
            {slices.map((s) => (
              <li
                key={s.bankId}
                className="dashboard-bank-pie-legend-item"
                title={`${s.bankLabel}: ${formatReportAmountForDisplay(s.amount)}`}
              >
                <span className="dashboard-bank-pie-legend-swatch" style={{ background: s.color }} aria-hidden="true" />
                <span className="dashboard-bank-pie-legend-label">{s.bankLabel}</span>
                <span className="dashboard-bank-pie-legend-value">{s.achievedPct.toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="dashboard-bank-pie-empty">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="dashboard-bank-pie" aria-hidden="true">
            <circle cx={cx} cy={cy} r={r} className="dashboard-bank-pie-track" />
          </svg>
          <p className="dashboard-widget-empty dashboard-widget-empty--inline">No bank recovery</p>
        </div>
      )}
    </div>
  );
}
