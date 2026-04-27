"use client";

/**
 * Shown after create when `config/modules.js` sets `postCreateAck` and the API returns `postCreateAck.value`.
 * Copy + Continue; optional Print Branch Copy slot (per-module via `showPrintPdf`).
 */
import { useEffect, useId, useState } from "react";

export default function PostCreateAckModal({
  open,
  value,
  title,
  hint,
  recordId,
  suppressValue = false,
  showPrintPdf = false,
  onContinue,
  onPrintPdf
}) {
  const [copied, setCopied] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  if (!open) return null;

  const heading = title?.trim() || "Reference assigned";
  const hintText =
    hint != null && String(hint).trim() !== "" ? String(hint).trim() : "Note this reference before continuing.";
  const hasValue = !suppressValue && value != null && String(value).trim() !== "";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be denied */
    }
  }

  function handlePrintBranchCopyClick() {
    if (typeof onPrintPdf === "function") {
      onPrintPdf(recordId, value);
    }
  }

  return (
    <div className="post-create-ack-modal-backdrop" role="presentation">
      <div
        className="post-create-ack-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="post-create-ack-modal-header">
          <h2 id={titleId} className="post-create-ack-modal-title">
            {heading}
          </h2>
        </div>
        <div className="post-create-ack-modal-body">
          <p className="post-create-ack-hint">{hintText}</p>
          {hasValue ? (
            <div className="post-create-ack-value" tabIndex={0}>
              {value}
            </div>
          ) : null}
        </div>
        <div className="post-create-ack-modal-footer">
          {hasValue ? (
            <button type="button" className="master-btn master-btn-outline" onClick={handleCopy}>
              {copied ? "Copied" : "Copy"}
            </button>
          ) : null}
          {showPrintPdf ? (
            <button
              type="button"
              className="master-btn master-btn-outline"
              onClick={handlePrintBranchCopyClick}
              disabled={recordId == null}
              title={recordId == null ? "Save record first to enable Branch Copy print" : "Branch Copy print will be available soon"}
            >
              Print Branch Copy
            </button>
          ) : null}
          <button type="button" className="master-btn master-btn-primary" onClick={onContinue}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
