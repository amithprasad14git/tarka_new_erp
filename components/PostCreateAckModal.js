"use client";

// Generic/shared file used across modules.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Shown after create when `config/modules.js` sets `postCreateAck` and the API returns `postCreateAck.value`.
 * Copy + Continue; optional print slot (per-module via `showPrintPdf`).
 * `showCopyButton` — set false when only Continue + print should show (e.g. Public Notice).
 *
 * IMPORTANT ARCHITECTURE RULE (layman):
 * - This modal is generic UI only.
 * - It should not know module names or module rules.
 * - Parent/module adapters must pass labels/actions through props.
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
  showCopyButton = true,
  printButtonLabel = "Print",
  onContinue,
  onPrintPdf
}) {
  const [copied, setCopied] = useState(false);
  const titleId = useId();

  useEffect(() => {
    // Reset "Copied" feedback when the modal closes or reopens.
    if (!open) setCopied(false);
  }, [open]);

  if (!open) return null;

  const heading = title?.trim() || "Reference assigned";
  const hintText =
    hint != null && String(hint).trim() !== "" ? String(hint).trim() : "Note this reference before continuing.";
  const hasValue = !suppressValue && value != null && String(value).trim() !== "";

  async function handleCopy() {
    try {
      // Copy the assigned reference number to the clipboard for the user.
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be denied */
    }
  }

  function handlePrintPdfClick() {
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
          {hasValue && showCopyButton ? (
            <button type="button" className="master-btn master-btn-outline" onClick={handleCopy}>
              {copied ? "Copied" : "Copy"}
            </button>
          ) : null}
          {showPrintPdf ? (
            <button
              type="button"
              className="master-btn master-btn-outline"
              onClick={handlePrintPdfClick}
              disabled={recordId == null}
              title={recordId == null ? "Save record first to enable print" : "Download PDF"}
            >
              {printButtonLabel}
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

