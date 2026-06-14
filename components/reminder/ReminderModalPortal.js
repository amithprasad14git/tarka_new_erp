"use client";

import { createPortal } from "react-dom";

export default function ReminderModalPortal({ children }) {
  return createPortal(children, document.body);
}
