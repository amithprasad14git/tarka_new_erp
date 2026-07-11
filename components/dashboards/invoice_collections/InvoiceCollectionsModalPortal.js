"use client";

// Dashboard portal — renders Invoice Collections modals on document.body (above widget z-index).

/**
 * Uses React createPortal so modal backdrop covers the full page, not just the widget card.
 * Used by InvoiceCollectionsSummaryModal.js drilldown.
 */

import { createPortal } from "react-dom";

/**
 * @param {{ children: import("react").ReactNode }} props
 */
export default function InvoiceCollectionsModalPortal({ children }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

