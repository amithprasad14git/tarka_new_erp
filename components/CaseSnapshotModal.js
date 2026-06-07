"use client";

/**
 * Generic presentational modal for selected-case snapshot.
 * Uses the same Peek-style layout as NCI grid “View record” (all parent fields + child tables).
 */
import { NciCasePeekDetailContent } from "../lib/modules/newCaseInwardClient";

export default function CaseSnapshotModal({
  open,
  onClose,
  selectedCaseId,
  loading,
  preview
}) {
  if (!open) return null;

  const detail = preview?.detail;

  return (
    <div className="audit-json-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="audit-json-modal case-snapshot-modal-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="case-snapshot-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="audit-json-modal-header">
          <h3 id="case-snapshot-modal-title" className="audit-json-modal-title">
            Selected Case Snapshot
          </h3>
          <button type="button" className="audit-json-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="case-snapshot-modal-body">
          {!selectedCaseId ? (
            <div className="subtle" style={{ padding: "8px 0" }}>
              Select Case No to view Snapshot.
            </div>
          ) : loading ? (
            // Skeleton placeholders while case detail API loads.
            <div className="pn-skeleton-card" aria-hidden>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="pn-skeleton-row">
                  <span className="pn-skeleton-cell pn-skeleton-cell-label" />
                  <span className="pn-skeleton-cell pn-skeleton-cell-value" />
                </div>
              ))}
            </div>
          ) : detail ? (
            <NciCasePeekDetailContent detail={detail} />
          ) : (
            <div className="subtle" style={{ padding: "8px 0" }}>
              No snapshot data available for this case.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
