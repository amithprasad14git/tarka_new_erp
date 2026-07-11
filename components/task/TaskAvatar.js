"use client";

/**
 * React UI component: TaskAvatar
 * Circular initials avatar for assignees, follow-up people, and comment authors.
 * Keep module-specific business rules in lib/modules/*Client.js, not here.
 */

import { initialsFromName } from "./taskUtils";

/**
 * @param {{ name?: string, size?: "sm" | "md" }} props
 */
export default function TaskAvatar({ name, size = "md" }) {
  const initials = initialsFromName(name);
  return (
    <span className={`task-avatar task-avatar--${size}`} title={name || undefined} aria-hidden={!name}>
      {initials}
    </span>
  );
}
