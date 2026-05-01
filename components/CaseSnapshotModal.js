"use client";

/**
 * Generic presentational modal for selected-case snapshot.
 * Receives already-prepared state/data from module hooks.
 */
export default function CaseSnapshotModal({
  open,
  onClose,
  selectedCaseId,
  loading,
  preview
}) {
  if (!open) return null;

  return (
    <div className="audit-json-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="audit-json-modal"
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
        <div className="audit-compare-table-wrap" style={{ padding: "12px" }}>
          {!selectedCaseId ? (
            <div className="subtle" style={{ padding: "8px 0" }}>
              Select Case No to view snapshot.
            </div>
          ) : loading ? (
            <div className="pn-skeleton-card" aria-hidden>
              <div className="pn-skeleton-row">
                <span className="pn-skeleton-cell pn-skeleton-cell-label" />
                <span className="pn-skeleton-cell pn-skeleton-cell-value" />
              </div>
              <div className="pn-skeleton-row">
                <span className="pn-skeleton-cell pn-skeleton-cell-label" />
                <span className="pn-skeleton-cell pn-skeleton-cell-value" />
              </div>
              <div className="pn-skeleton-row">
                <span className="pn-skeleton-cell pn-skeleton-cell-label" />
                <span className="pn-skeleton-cell pn-skeleton-cell-value" />
              </div>
              <div className="pn-skeleton-row">
                <span className="pn-skeleton-cell pn-skeleton-cell-label" />
                <span className="pn-skeleton-cell pn-skeleton-cell-value" />
              </div>
              <div className="pn-skeleton-row">
                <span className="pn-skeleton-cell pn-skeleton-cell-label" />
                <span className="pn-skeleton-cell pn-skeleton-cell-value" />
              </div>
              <div className="pn-skeleton-row">
                <span className="pn-skeleton-cell pn-skeleton-cell-label" />
                <span className="pn-skeleton-cell pn-skeleton-cell-value" />
              </div>
              <div className="pn-skeleton-row">
                <span className="pn-skeleton-cell pn-skeleton-cell-label" />
                <span className="pn-skeleton-cell pn-skeleton-cell-value" />
              </div>
              <div className="pn-skeleton-row">
                <span className="pn-skeleton-cell pn-skeleton-cell-label" />
                <span className="pn-skeleton-cell pn-skeleton-cell-value" />
              </div>
              <div className="pn-skeleton-row">
                <span className="pn-skeleton-cell pn-skeleton-cell-label" />
                <span className="pn-skeleton-cell pn-skeleton-cell-value" />
              </div>
            </div>
          ) : preview ? (
            <table className="audit-compare-table pn-snapshot-table">
              <tbody>
                <tr>
                  <td>Case No</td>
                  <td>{preview?.caseNo || "—"}</td>
                </tr>
                <tr>
                  <td>Borrower</td>
                  <td>{preview?.borrower || "—"}</td>
                </tr>
                <tr>
                  <td>Unit</td>
                  <td>{preview?.unit || "—"}</td>
                </tr>
                <tr>
                  <td>Branch</td>
                  <td>{preview?.branch || "—"}</td>
                </tr>
                <tr>
                  <td>Loan Category</td>
                  <td>{preview?.loanCategory || "—"}</td>
                </tr>
                <tr>
                  <td>Loan Type</td>
                  <td>{preview?.loanType || "—"}</td>
                </tr>
                <tr>
                  <td>Case Status</td>
                  <td>{preview?.status || "—"}</td>
                </tr>
                <tr>
                  <td>Status Updated Date</td>
                  <td>{preview?.caseStatusUpdatedDateDisplay ?? "—"}</td>
                </tr>
                <tr>
                  <td>Case Status Remarks</td>
                  <td style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {preview?.caseStatusRemarks ? preview.caseStatusRemarks : "—"}
                  </td>
                </tr>
                <tr>
                  <td>Amount Recovered</td>
                  <td>{preview?.totalRecoveredDisplay ?? "—"}</td>
                </tr>
              </tbody>
            </table>
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

