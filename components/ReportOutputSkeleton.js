"use client";

// Report UI — placeholder skeleton while HTML report loads.

const SKELETON_ROWS = 8;

export default function ReportOutputSkeleton() {
  return (
    <section className="report-output report-output-skeleton card" aria-label="Loading report" aria-busy="true">
      <div className="report-output-skeleton-header">
        <div className="report-output-skeleton-block report-output-skeleton-logo" />
        <div className="report-output-skeleton-block report-output-skeleton-title" />
        <div className="report-output-skeleton-block report-output-skeleton-line" />
      </div>
      <div className="report-output-table-wrap">
        <div className="report-output-skeleton-table">
          <div className="report-output-skeleton-block report-output-skeleton-thead" />
          {Array.from({ length: SKELETON_ROWS }, (_, i) => (
            <div
              key={i}
              className={`report-output-skeleton-row${i % 2 === 1 ? " report-output-skeleton-row--odd" : ""}`}
            >
              <div className="report-output-skeleton-block report-output-skeleton-cell" />
              <div className="report-output-skeleton-block report-output-skeleton-cell" />
              <div className="report-output-skeleton-block report-output-skeleton-cell" />
              <div className="report-output-skeleton-block report-output-skeleton-cell" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

