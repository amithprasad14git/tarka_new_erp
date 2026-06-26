"use client";

// Section header for dashboard sub-panels — matches main card title/subtitle typography.

/**
 * Title + optional subtitle for each sub-panel inside a dashboard widget card.
 * @param {{ title: string, subtitle?: string }} props
 */
export default function DashboardSectionHeader({ title, subtitle = "" }) {
  return (
    <div className="dashboard-recovery-section-header">
      <h4 className="dashboard-recovery-section-title">{title}</h4>
      {subtitle ? <p className="dashboard-recovery-section-subtitle">{subtitle}</p> : null}
    </div>
  );
}
