"use client";

import { createPortal } from "react-dom";

/** Renders modals on document.body so layout/overflow on the widget cannot break them. */
export default function TaskModalPortal({ children }) {
  return createPortal(children, document.body);
}
