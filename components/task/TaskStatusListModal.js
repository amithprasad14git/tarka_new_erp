"use client";

// Dashboard drilldown — full task list modal (View all / status click from My Tasks).

/**
 * Paginated task table in a full-screen modal. Filter by status tab, bucket (assigned vs created),
 * and search. Opens TaskDetailPanel via onSelectTask. Parent: MyTasksWidget.js.
 * API: GET /api/task?bucket=assigned_to_me|created_by_me
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import TaskBucketSwitch from "./TaskBucketSwitch";
import TaskExpandableSearch from "./TaskExpandableSearch";
import TaskAvatar from "./TaskAvatar";
import { TaskPriorityDot } from "./TaskStatusBadge";
import TaskStatusNav from "./TaskStatusNav";
import PaginationBar from "../PaginationBar";
import {
  bucketSubtitle,
  daysPastDue,
  formatTaskDate,
  overdueDaysSeverity,
  TASK_STATUSES,
  truncateText,
  VIEW_ALL_STATUS,
  sortTasksForListView
} from "./taskUtils";
import { formatApiErrorPayload, readJsonResponse } from "../../lib/fetchClientError";
import TaskModalPortal from "./TaskModalPortal";

/** Split flat task list into buckets keyed by TASK_STATUSES. */
function groupTasksByStatus(tasks) {
  const groups = Object.fromEntries(TASK_STATUSES.map((st) => [st, []]));
  for (const task of tasks) {
    const st = TASK_STATUSES.includes(task.status) ? task.status : "Pending";
    groups[st].push(task);
  }
  return groups;
}

/** Map widget drilldown status (or VIEW_ALL) to modal initial tab. */
function resolveInitialStatus(initialStatus) {
  if (initialStatus === VIEW_ALL_STATUS) return VIEW_ALL_STATUS;
  if (TASK_STATUSES.includes(initialStatus)) return initialStatus;
  return "Pending";
}

/** Assignee + follow-up avatar cells in the task table. */
function PeopleCell({ assigneeLabel, followUpLabel }) {
  const assignee = String(assigneeLabel || "").trim();
  const followUp = String(followUpLabel || "").trim();
  const showFollowUp = followUp && followUp !== assignee;
  const ariaParts = [];
  if (assignee) ariaParts.push(`Assignee: ${assignee}`);
  if (showFollowUp) ariaParts.push(`Follow-up: ${followUp}`);

  if (!assignee && !showFollowUp) {
    return <span className="task-group-muted">—</span>;
  }

  return (
    <div className="task-group-people" aria-label={ariaParts.join("; ") || undefined}>
      {assignee ? (
        <span className="task-group-people-avatar" title={`Assignee: ${assignee}`}>
          <TaskAvatar name={assignee} size="sm" />
        </span>
      ) : null}
      {showFollowUp ? (
        <span className="task-group-people-avatar" title={`Follow-up: ${followUp}`}>
          <TaskAvatar name={followUp} size="sm" />
        </span>
      ) : null}
    </div>
  );
}

/** Placeholder rows while task list API is loading. */
function TableListSkeleton() {
  return (
    <div className="task-list-table-skeleton" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="task-list-table-skeleton-row" />
      ))}
    </div>
  );
}

/** Overdue day count with color severity (red = very overdue). */
function DaysPastDueCell({ dueDate, status }) {
  const days = daysPastDue(dueDate, status);
  const severity = overdueDaysSeverity(days);

  if (days == null) {
    return <span className="task-group-muted">—</span>;
  }
  if (days <= 0) {
    return <span className="task-group-overdue task-group-overdue--none">—</span>;
  }

  return (
    <span className={`task-group-overdue task-group-overdue--${severity}`}>
      {days}d
    </span>
  );
}

/** Single row in the task list table — Edit opens detail panel. */
function TaskListTableRow({ task, onOpen }) {
  return (
    <tr className="task-group-row">
      <td className="task-group-col-task">
        <span className="task-group-task-title">{task.taskTitle || "Untitled"}</span>
      </td>
      <td className="task-group-col-desc">
        <span className="task-group-desc">
          {task.description ? truncateText(task.description, 60) : "—"}
        </span>
      </td>
      <td className="task-group-col-people">
        <PeopleCell assigneeLabel={task.assigneeLabel} followUpLabel={task.followUpPersonLabel} />
      </td>
      <td className="task-group-col-due">
        {task.dueDate ? formatTaskDate(task.dueDate) : <span className="task-group-muted">—</span>}
      </td>
      <td className="task-group-col-overdue">
        <DaysPastDueCell dueDate={task.dueDate} status={task.status} />
      </td>
      <td className="task-group-col-priority">
        <TaskPriorityDot priority={task.priority} />
      </td>
      <td className="task-group-col-action">
        <button
          type="button"
          className="master-btn master-btn-sm master-btn-outline task-group-edit-btn"
          onClick={() => onOpen(task)}
        >
          Edit
        </button>
      </td>
    </tr>
  );
}

/** Shown when search or status filter returns zero tasks. */
function ListEmptyState({ search, activeStatus }) {
  const statusLabel =
    activeStatus === VIEW_ALL_STATUS ? "tasks" : `${activeStatus.toLowerCase()} tasks`;

  return (
    <div className="task-list-modal-empty">
      <div className="task-list-modal-empty-icon" aria-hidden="true">
        ◫
      </div>
      <p className="task-list-modal-empty-title">No tasks found</p>
      <p className="task-list-modal-empty-text">
        {search.trim()
          ? "Try a different search term or switch task scope."
          : `There are no ${statusLabel} in this view yet.`}
      </p>
    </div>
  );
}

/**
 * Full-screen task list modal with status tabs, bucket switch, search, pagination.
 * @param {{
 *   open: boolean,
 *   initialStatus: string | null,
 *   refreshKey?: number,
 *   onClose: () => void,
 *   onSelectTask: (task: object) => void,
 *   onAddTask?: () => void
 * }} props
 */
export default function TaskStatusListModal({
  open,
  initialStatus,
  refreshKey = 0,
  onClose,
  onSelectTask,
  onAddTask
}) {
  const titleId = useId();
  const prevOpenRef = useRef(false);
  const [bucket, setBucket] = useState("assigned_to_me");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tasks, setTasks] = useState([]);
  const [search, setSearch] = useState("");
  const [activeStatus, setActiveStatus] = useState(() => resolveInitialStatus(initialStatus));
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setBucket("assigned_to_me");
      setSearch("");
      setActiveStatus(resolveInitialStatus(initialStatus));
      setPage(1);
      setLimit(10);
    }
    prevOpenRef.current = open;
  }, [open, initialStatus]);

  useEffect(() => {
    setPage(1);
  }, [activeStatus, search]);

  /** Fetch tasks for current bucket (assigned_to_me vs created_by_me). */
  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams({ bucket });
      const res = await fetch(`/api/task?${q.toString()}`, { cache: "no-store" });
      const body = await readJsonResponse(res);
      if (!res.ok) {
        setError(formatApiErrorPayload(body, "Failed to load tasks"));
        return;
      }
      setTasks(body.rows || []);
    } catch {
      setError("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [bucket]);

  useEffect(() => {
    if (!open) return;
    loadTasks();
  }, [open, bucket, refreshKey, loadTasks]);

  /** Client-side search across title, description, people, priority, status. */
  const searchFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) => {
      const hay = [
        t.taskTitle,
        t.description,
        t.createdByLabel,
        t.assigneeLabel,
        t.followUpPersonLabel,
        t.priority,
        t.status
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [tasks, search]);

  const statusCounts = useMemo(() => {
    const grouped = groupTasksByStatus(searchFiltered);
    return {
      ...Object.fromEntries(TASK_STATUSES.map((st) => [st, grouped[st].length])),
      [VIEW_ALL_STATUS]: searchFiltered.length
    };
  }, [searchFiltered]);

  const statusFiltered = useMemo(() => {
    let filtered = searchFiltered;
    if (activeStatus !== VIEW_ALL_STATUS) {
      filtered = searchFiltered.filter((t) => {
        const st = TASK_STATUSES.includes(t.status) ? t.status : "Pending";
        return st === activeStatus;
      });
    }
    return sortTasksForListView(filtered, activeStatus);
  }, [searchFiltered, activeStatus]);

  const totalPages = Math.max(1, Math.ceil(statusFiltered.length / limit) || 1);
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedTasks = useMemo(() => {
    const start = (safePage - 1) * limit;
    return statusFiltered.slice(start, start + limit);
  }, [statusFiltered, safePage, limit]);

  function handleBucketChange(nextBucket) {
    setBucket(nextBucket);
    setSearch("");
    setPage(1);
  }

  if (!open) return null;

  function handleOpenTask(task) {
    onSelectTask?.(task);
  }

  const scopeTotalCount = searchFiltered.length;
  const statusTotalCount = statusFiltered.length;

  return (
    <TaskModalPortal>
      <div className="task-modal-backdrop" role="presentation">
        <div
          className="task-modal task-modal--task-list task-modal--task-list-split"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <header className="task-modal-header task-list-modal-header">
            <div className="task-modal-heading">
              <h2 id={titleId} className="task-modal-title">
                Tasks
              </h2>
              <p className="task-modal-subtitle">{bucketSubtitle(bucket, scopeTotalCount)}</p>
            </div>
            <button type="button" className="task-modal-close" onClick={() => onClose?.()} aria-label="Close">
              ×
            </button>
          </header>

          {error ? (
            <p className="task-form-error task-list-modal-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="task-list-split-body">
            <TaskStatusNav
              activeStatus={activeStatus}
              onChange={setActiveStatus}
              counts={statusCounts}
              loading={loading}
            />

            <div className="task-list-table-pane">
              <div className="task-list-table-toolbar">
                <TaskExpandableSearch key={bucket} open={open} value={search} onChange={setSearch} />
                <span className="task-list-command-divider" aria-hidden="true" />
                <TaskBucketSwitch
                  variant="pill"
                  value={bucket}
                  onChange={handleBucketChange}
                  showHelp={false}
                />
                <span className="task-list-command-divider" aria-hidden="true" />
                <div className="task-list-modal-toolbar-meta">
                  {!loading ? (
                    <span className="task-list-modal-count">
                      {scopeTotalCount} {scopeTotalCount === 1 ? "task" : "tasks"}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className={`task-list-modal-refresh${loading ? " is-spinning" : ""}`}
                    onClick={loadTasks}
                    disabled={loading}
                    aria-label="Refresh list"
                    title="Refresh"
                  >
                    ↻
                  </button>
                </div>
                <button
                  type="button"
                  className="master-btn master-btn-primary task-list-toolbar-add-btn"
                  onClick={() => onAddTask?.()}
                >
                  Add Task
                </button>
              </div>

              {loading ? (
                <TableListSkeleton />
              ) : statusTotalCount === 0 ? (
                <ListEmptyState search={search} activeStatus={activeStatus} />
              ) : (
                <>
                  <div className="task-list-table-wrap">
                    <table className="task-status-group-table task-list-split-table">
                      <thead>
                        <tr>
                          <th>Task</th>
                          <th>Description</th>
                          <th>People</th>
                          <th>Due date</th>
                          <th>Days past due</th>
                          <th>Priority</th>
                          <th className="task-group-col-action">
                            <span className="sr-only">Action</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedTasks.map((task) => (
                          <TaskListTableRow key={task.id} task={task} onOpen={handleOpenTask} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="task-list-modal-footer">
                    <PaginationBar
                      page={safePage}
                      totalPages={totalPages}
                      total={statusTotalCount}
                      limit={limit}
                      onPageChange={setPage}
                      onLimitChange={(next) => {
                        setLimit(next);
                        setPage(1);
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </TaskModalPortal>
  );
}
