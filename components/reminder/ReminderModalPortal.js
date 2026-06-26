"use client";

// Dashboard portal — renders reminder modals on document.body (above widget z-index).

/**
 * Uses React createPortal so reminder list/create/detail dialogs cover the full page.
 * Used by ReminderListModal, ReminderCreateModal, ReminderDetailPanel.
 */

import { createPortal } from "react-dom";

/**
 * @param {{ children: import("react").ReactNode }} props
 */
export default function ReminderModalPortal({ children }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
