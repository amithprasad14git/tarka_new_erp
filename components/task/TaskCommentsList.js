"use client";

import TaskAvatar from "./TaskAvatar";
import { formatTaskDateTime } from "./taskUtils";

export default function TaskCommentsList({ rows, userNamesById = {} }) {
  const list = rows || [];
  if (!list.length) {
    return <p className="task-empty-inline">No comments yet. Be the first to add one.</p>;
  }
  return (
    <ul className="task-activity-thread">
      {list.map((r) => {
        const name = r.commentedByLabel || userNamesById[r.commentedBy] || "User";
        return (
          <li key={r.id} className="task-activity-item">
            <TaskAvatar name={name} size="sm" />
            <div className="task-activity-bubble">
              <div className="task-activity-head">
                <strong>{name}</strong>
                <time className="task-activity-time">
                  {r.commentedAt ? formatTaskDateTime(r.commentedAt) : ""}
                </time>
              </div>
              <p className="task-activity-text">{r.commentText}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
