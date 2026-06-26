"use client";

// Dashboard portal — renders task modals on document.body (above widget z-index).

/**
 * Uses React createPortal so task list/create/detail dialogs cover the full page.
 * Used by TaskStatusListModal, TaskCreateModal, TaskDetailPanel.
 */

import { createPortal } from "react-dom";

/**
 * @param {{ children: import("react").ReactNode }} props
 */
export default function TaskModalPortal({ children }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
