"use client";

import { initialsFromName } from "./taskUtils";

export default function TaskAvatar({ name, size = "md" }) {
  const initials = initialsFromName(name);
  return (
    <span className={`task-avatar task-avatar--${size}`} title={name || undefined} aria-hidden={!name}>
      {initials}
    </span>
  );
}
