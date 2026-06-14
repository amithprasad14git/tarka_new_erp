"use client";

export default function TaskStatusHistoryList({ rows, userNamesById = {} }) {
  const list = rows || [];
  if (!list.length) {
    return <p className="task-empty-inline">No status changes recorded yet.</p>;
  }
  return (
    <ul className="task-timeline">
      {list.map((r, i) => {
        const name = r.changedByLabel || userNamesById[r.changedBy] || "User";
        const isLast = i === list.length - 1;
        return (
          <li key={r.id} className={`task-timeline-item${isLast ? " is-last" : ""}`}>
            <span className="task-timeline-dot" aria-hidden="true" />
            <div className="task-timeline-content">
              <p className="task-timeline-text">
                <strong>{name}</strong> changed status to <strong>{r.toStatus}</strong>
                {r.fromStatus ? (
                  <span className="task-timeline-from"> from {r.fromStatus}</span>
                ) : null}
              </p>
              <time className="task-timeline-time">
                {r.changedAt ? String(r.changedAt).replace("T", " ").slice(0, 19) : ""}
              </time>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
