"use client";

// Dashboard modal — view/edit a single task from list or widget drilldown.

/**
 * Side panel / modal for one task: details form, status pills, comments, activity feed.
 * GET/PATCH /api/task/:id. Respects role-based permissions banner.
 * Parent: MyTasksWidget.js via TaskModalPortal.
 */

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import LookupSelect from "../LookupSelect";
import TaskDetailFeedTabs from "./TaskDetailFeedTabs";
import TaskPriorityPicker from "./TaskPriorityPicker";
import TaskStatusPills from "./TaskStatusPills";
import TaskAvatar from "./TaskAvatar";
import TaskStatusBadge from "./TaskStatusBadge";
import { formatTaskDate, isDueDateOnOrAfterToday, daysPastDue, overdueDaysSeverity } from "./taskUtils";
import { formatApiErrorPayload, readJsonResponse } from "../../lib/fetchClientError";
import TaskModalPortal from "./TaskModalPortal";

/** Plain-English banner when user has limited edit rights on this task. */
function permissionBannerText(permissions) {
  if (!permissions) return null;
  if (permissions.isCompletedLocked) {
    return "This task is completed. Only the task creator can make changes.";
  }
  if (permissions.isFollowUpOnly) {
    return "You are the follow-up person — you can add comments only.";
  }
  if (permissions.canEditDetails && permissions.canUpdateStatus) return null;
  if (permissions.canEditDetails) {
    return "You can update task details and add comments. Status is updated by the assignee.";
  }
  if (permissions.canUpdateStatus) {
    return "You can update status and add comments. Task details are managed by the creator.";
  }
  return null;
}

/** Normalize API due date to YYYY-MM-DD for date input. */
function dueDateValue(raw) {
  if (!raw) return "";
  return String(raw).slice(0, 10);
}

/** Normalize follow-up person id for LookupSelect. */
function followUpValue(raw) {
  if (raw == null || raw === "") return "";
  return String(raw);
}

/** Small stroke icon for property labels (presentation only). */
function PropIcon({ children }) {
  return (
    <svg
      className="task-dv-prop-icon"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Overdue days readout in task detail header. */
function DaysPastDueDisplay({ dueDate, status }) {
  const days = daysPastDue(dueDate, status);
  const severity = overdueDaysSeverity(days);

  if (days == null || days <= 0) {
    return <p className="task-detail-meta-value">—</p>;
  }

  return (
    <p className={`task-detail-meta-value task-group-overdue task-group-overdue--${severity}`}>{days}d</p>
  );
}

/** Hydrate form state from GET /api/task/:id response. */
function resetFormFromTask(data, setters) {
  setters.setTask(data);
  setters.setPermissions(data.permissions || null);
  setters.setTaskTitle(data.taskTitle || "");
  setters.setDescription(data.description || "");
  setters.setDueDate(dueDateValue(data.dueDate));
  setters.setPriority(data.priority || "Medium");
  setters.setFollowUpPerson(followUpValue(data.followUpPerson));
  setters.setStatus(data.status || "Pending");
}

/**
 * Task detail/edit dialog — loads by taskId when open.
 * @param {{ open: boolean, taskId: number | string | null, onClose: () => void, onUpdated?: () => void }} props
 */
export default function TaskDetailPanel({ open, taskId, onClose, onUpdated }) {
  const dialogTitleId = useId();
  const titleId = useId();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const [error, setError] = useState("");
  const [task, setTask] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [activity, setActivity] = useState([]);
  const [comments, setComments] = useState([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [followUpPerson, setFollowUpPerson] = useState("");
  const [status, setStatus] = useState("");
  const [commentText, setCommentText] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const formSetters = useMemo(
    () => ({
      setTask,
      setPermissions,
      setTaskTitle,
      setDescription,
      setDueDate,
      setPriority,
      setFollowUpPerson,
      setStatus
    }),
    []
  );

  const reloadFormFromTask = useCallback(
    (data) => {
      resetFormFromTask(data, formSetters);
    },
    [formSetters]
  );

  const loadTask = useCallback(async () => {
    if (!taskId) return null;
    const res = await fetch(`/api/task/${encodeURIComponent(taskId)}`, { cache: "no-store" });
    const body = await readJsonResponse(res);
    if (!res.ok) {
      throw new Error(formatApiErrorPayload(body, "Failed to load task"));
    }
    return body;
  }, [taskId]);

  useEffect(() => {
    if (!open || !taskId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      setIsEditing(false);
      setCommentText("");
      try {
        const body = await loadTask();
        if (cancelled || !body) return;
        const data = body.data || {};
        reloadFormFromTask(data);
        setActivity(body.childTableRows?.activity_log || []);
        setComments(body.childTableRows?.comments || []);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load task");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, taskId, loadTask, reloadFormFromTask]);

  const userNamesById = useMemo(() => {
    const map = {};
    if (task?.createdByLabel && task?.createdBy) {
      map[task.createdBy] = task.createdByLabel;
    }
    if (task?.assigneeLabel && task?.assignee) {
      map[task.assignee] = task.assigneeLabel;
    }
    if (task?.followUpPersonLabel && task?.followUpPerson) {
      map[task.followUpPerson] = task.followUpPersonLabel;
    }
    for (const c of comments) {
      if (c.commentedBy) {
        map[c.commentedBy] = map[c.commentedBy] || c.commentedByLabel || task?.assigneeLabel;
      }
    }
    for (const a of activity) {
      if (a.changedBy) {
        map[a.changedBy] = map[a.changedBy] || a.changedByLabel;
      }
      if (a.fieldName === "followUpPerson") {
        if (a.fromValue) map[Number(a.fromValue)] = map[Number(a.fromValue)] || a.fromValue;
        if (a.toValue) map[Number(a.toValue)] = map[Number(a.toValue)] || a.toValue;
      }
    }
    return map;
  }, [task, comments, activity]);

  const isCompletedLocked = Boolean(permissions?.isCompletedLocked);
  const canEditDetails = Boolean(permissions?.canEditDetails);
  const canUpdateStatus = Boolean(permissions?.canUpdateStatus);
  const canComment = Boolean(permissions?.canComment) && !isCompletedLocked;

  const canEnterEditMode = canEditDetails && !isCompletedLocked;
  const fieldsEditable = isEditing && canEditDetails;
  const statusEditable =
    canUpdateStatus && !isCompletedLocked && (!canEditDetails || isEditing);

  const bannerText = permissionBannerText(permissions);
  const showPermissionBanner = Boolean(bannerText);

  const effectiveDueDate = dueDate || (task?.dueDate ? String(task.dueDate).slice(0, 10) : "");
  const effectiveStatus = status || task?.status || "Pending";

  const hasDetailChanges = useMemo(() => {
    if (!task || !isEditing || !canEditDetails) return false;
    return (
      taskTitle.trim() !== (task.taskTitle || "").trim() ||
      (description || "").trim() !== (task.description || "").trim() ||
      dueDate !== dueDateValue(task.dueDate) ||
      priority !== (task.priority || "Medium") ||
      followUpPerson !== followUpValue(task.followUpPerson)
    );
  }, [
    task,
    isEditing,
    canEditDetails,
    taskTitle,
    description,
    dueDate,
    priority,
    followUpPerson
  ]);

  const hasStatusChanges = useMemo(() => {
    if (!task || !canUpdateStatus) return false;
    return status !== (task.status || "Pending");
  }, [task, canUpdateStatus, status]);

  const hasSaveableChanges = hasDetailChanges || hasStatusChanges;
  const hasStatusOnlyChanges = hasStatusChanges && !canEditDetails;

  function handleCancelEdit() {
    if (task) reloadFormFromTask(task);
    setIsEditing(false);
    setError("");
  }

  function handleCancelStatusChange() {
    if (task) setStatus(task.status || "Pending");
    setError("");
  }

  async function refreshAfterSave() {
    const body = await loadTask();
    if (!body) return;
    const data = body.data || {};
    reloadFormFromTask(data);
    setActivity(body.childTableRows?.activity_log || []);
    setComments(body.childTableRows?.comments || []);
    setIsEditing(false);
    onUpdated?.();
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!hasSaveableChanges) return;
    const currentDueDate = dueDateValue(task?.dueDate);
    const dueDateChanged = dueDate !== currentDueDate;
    if (canEditDetails && dueDateChanged && dueDate && !isDueDateOnOrAfterToday(dueDate)) {
      setError("Due date cannot be in the past.");
      return;
    }
    if (
      canEditDetails &&
      followUpPerson &&
      task?.assignee &&
      Number(followUpPerson) === Number(task.assignee)
    ) {
      setError("Follow-up person cannot be the same as the assignee.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {};
      if (canEditDetails) {
        if (taskTitle.trim() !== (task?.taskTitle || "").trim()) payload.taskTitle = taskTitle.trim();
        if ((description || "").trim() !== (task?.description || "").trim()) {
          payload.description = description.trim() || null;
        }
        if (dueDate !== dueDateValue(task?.dueDate)) payload.dueDate = dueDate || null;
        if (priority !== (task?.priority || "Medium")) payload.priority = priority;
        if (followUpPerson !== followUpValue(task?.followUpPerson)) {
          payload.followUpPerson = followUpPerson ? Number(followUpPerson) : null;
        }
      }
      if (canUpdateStatus && status !== (task?.status || "Pending")) {
        payload.status = status;
      }

      const res = await fetch(`/api/task/${encodeURIComponent(taskId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await readJsonResponse(res);
      if (!res.ok) {
        setError(formatApiErrorPayload(body, "Failed to save"));
        return;
      }
      onUpdated?.();
      onClose?.();
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handlePostComment() {
    const text = commentText.trim();
    if (!text || !canComment) return;
    setPostingComment(true);
    setError("");
    try {
      const res = await fetch(`/api/task/${encodeURIComponent(taskId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentText: text })
      });
      const body = await readJsonResponse(res);
      if (!res.ok) {
        setError(formatApiErrorPayload(body, "Failed to post comment"));
        return;
      }
      setCommentText("");
      await refreshAfterSave();
    } catch {
      setError("Failed to post comment");
    } finally {
      setPostingComment(false);
    }
  }

  if (!open) return null;

  const statusSlug = String(task?.status || "pending").toLowerCase().replace(/\s+/g, "-");

  return (
    <TaskModalPortal>
      <div className="task-modal-backdrop" role="presentation">
        <div
          className={`task-modal task-modal--detail-enterprise task-detail-accent--${statusSlug}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
          onClick={(e) => e.stopPropagation()}
        >
          {loading ? (
            <div className="task-detail-loading">
              <p className="task-empty-state">Loading task…</p>
            </div>
          ) : (
            <form className="task-detail-form" onSubmit={handleSave}>
              <header className="task-hv-banner">
                <div className="task-hv-banner-top">
                  <div className="task-hv-banner-meta">
                    <h2 id={dialogTitleId} className="task-hv-eyebrow">
                      Task
                    </h2>
                    {task?.id ? <span className="task-hv-id">#{task.id}</span> : null}
                    {task?.status ? <TaskStatusBadge status={task.status} /> : null}
                  </div>
                  <button
                    type="button"
                    className="task-hv-close"
                    onClick={() => onClose?.()}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                {fieldsEditable ? (
                  <input
                    id={titleId}
                    type="text"
                    className="task-hv-title-input"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="Brief summary of the task…"
                    aria-label="Task name"
                    required
                  />
                ) : (
                  <h2 id={titleId} className="task-hv-title">
                    {task?.taskTitle || "Task"}
                  </h2>
                )}

              </header>

              {error ? <p className="task-form-error task-form-error--detail">{error}</p> : null}

              <div className="task-hv-scroll">
                <section className="task-hv-section task-hv-section--desc">
                  <h3 className="task-hv-section-label">Description</h3>
                  {fieldsEditable ? (
                    <textarea
                      className="task-textarea task-hv-desc-input"
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Add details, context, or links…"
                      aria-label="Description"
                    />
                  ) : task?.description ? (
                    <p className="task-hv-desc">{task.description}</p>
                  ) : (
                    <p className="task-hv-desc-empty">No description provided.</p>
                  )}
                </section>

                <div className="task-hv-tiles">
                  <div className="task-hv-tile task-hv-tile--status">
                    <span className="task-hv-tile-label">
                      <span className="task-hv-tile-icon">
                        <PropIcon>
                          <circle cx="8" cy="8" r="6" />
                          <circle cx="8" cy="8" r="2" fill="currentColor" stroke="none" />
                        </PropIcon>
                      </span>
                      Status
                    </span>
                    <div className="task-hv-tile-value">
                      {statusEditable ? (
                        <TaskStatusPills value={status} onChange={setStatus} />
                      ) : (
                        <TaskStatusBadge status={task?.status} />
                      )}
                    </div>
                  </div>

                  <div className="task-hv-tile task-hv-tile--priority">
                    <span className="task-hv-tile-label">
                      <span className="task-hv-tile-icon">
                        <PropIcon>
                          <path d="M3.5 14V2.5" />
                          <path d="M3.5 3h8.5l-2 3 2 3H3.5" />
                        </PropIcon>
                      </span>
                      Priority
                    </span>
                    <div className="task-hv-tile-value">
                      <TaskPriorityPicker
                        value={priority}
                        onChange={setPriority}
                        readOnly={!fieldsEditable}
                      />
                    </div>
                  </div>

                  <div className="task-hv-tile task-hv-tile--due">
                    <span className="task-hv-tile-label">
                      <span className="task-hv-tile-icon">
                        <PropIcon>
                          <rect x="2.5" y="3.5" width="11" height="10" rx="2" />
                          <path d="M5.5 2v3M10.5 2v3M2.5 7.5h11" />
                        </PropIcon>
                      </span>
                      Due date
                    </span>
                    <div className="task-hv-tile-value">
                      {fieldsEditable ? (
                        <input
                          type="date"
                          className="task-input"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                        />
                      ) : (
                        <p className="task-detail-meta-value">
                          {task?.dueDate ? formatTaskDate(task.dueDate) : "—"}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="task-hv-tile task-hv-tile--overdue">
                    <span className="task-hv-tile-label">
                      <span className="task-hv-tile-icon">
                        <PropIcon>
                          <circle cx="8" cy="8" r="6" />
                          <path d="M8 5v3l2 2" />
                        </PropIcon>
                      </span>
                      Days past due
                    </span>
                    <div className="task-hv-tile-value">
                      <DaysPastDueDisplay dueDate={effectiveDueDate} status={effectiveStatus} />
                    </div>
                  </div>

                  <div className="task-hv-tile task-hv-tile--assignee">
                    <span className="task-hv-tile-label">
                      <span className="task-hv-tile-icon">
                        <PropIcon>
                          <circle cx="8" cy="5" r="2.8" />
                          <path d="M2.8 13.5c.9-2.6 2.9-4 5.2-4s4.3 1.4 5.2 4" />
                        </PropIcon>
                      </span>
                      Assigned to
                    </span>
                    <div className="task-hv-tile-value">
                      {task?.assigneeLabel ? (
                        <div className="task-detail-person">
                          <TaskAvatar name={task.assigneeLabel} size="sm" />
                          <span>{task.assigneeLabel}</span>
                        </div>
                      ) : (
                        <p className="task-detail-meta-value">—</p>
                      )}
                    </div>
                  </div>

                  <div className="task-hv-tile task-hv-tile--followup">
                    <span className="task-hv-tile-label">
                      <span className="task-hv-tile-icon">
                        <PropIcon>
                          <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8Z" />
                          <circle cx="8" cy="8" r="2" />
                        </PropIcon>
                      </span>
                      Follow-up
                    </span>
                    <div className="task-hv-tile-value">
                      {fieldsEditable ? (
                        <LookupSelect
                          name="followUpPerson"
                          id="task-detail-follow-up"
                          fieldLabel="Follow-up person"
                          lookup={{
                            module: "users",
                            valueField: "id",
                            labelField: "fullName",
                            extraLovParams: { f_active: "Yes" }
                          }}
                          initialValue={followUpPerson}
                          onValueChange={(v) => setFollowUpPerson(v)}
                        />
                      ) : task?.followUpPersonLabel ? (
                        <div className="task-detail-person">
                          <TaskAvatar name={task.followUpPersonLabel} size="sm" />
                          <span>{task.followUpPersonLabel}</span>
                        </div>
                      ) : (
                        <p className="task-detail-meta-value">—</p>
                      )}
                    </div>
                  </div>

                  <div className="task-hv-tile task-hv-tile--creator">
                    <span className="task-hv-tile-label">
                      <span className="task-hv-tile-icon">
                        <PropIcon>
                          <circle cx="6.5" cy="5" r="2.8" />
                          <path d="M1.8 13.5c.8-2.6 2.6-4 4.7-4 1.1 0 2.1.4 2.9 1" />
                          <path d="M12.5 9.5v4M10.5 11.5h4" />
                        </PropIcon>
                      </span>
                      Created by
                    </span>
                    <div className="task-hv-tile-value">
                      {task?.createdByLabel ? (
                        <div className="task-detail-person">
                          <TaskAvatar name={task.createdByLabel} size="sm" />
                          <span>{task.createdByLabel}</span>
                        </div>
                      ) : (
                        <p className="task-detail-meta-value">—</p>
                      )}
                    </div>
                  </div>

                  <div className="task-hv-tile task-hv-tile--created">
                    <span className="task-hv-tile-label">
                      <span className="task-hv-tile-icon">
                        <PropIcon>
                          <rect x="2.5" y="3.5" width="11" height="10" rx="2" />
                          <path d="M5.5 2v3M10.5 2v3M2.5 7.5h11" />
                          <path d="M5.8 10.7l1.5 1.5 2.9-2.9" />
                        </PropIcon>
                      </span>
                      Created
                    </span>
                    <div className="task-hv-tile-value">
                      <p className="task-detail-meta-value">
                        {task?.createdDate
                          ? formatTaskDate(String(task.createdDate).slice(0, 10))
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>

                <section className="task-hv-section task-hv-section--feed">
                  <TaskDetailFeedTabs
                    key={taskId}
                    activity={activity}
                    comments={comments}
                    userNamesById={userNamesById}
                    canComment={canComment}
                    commentText={commentText}
                    onCommentChange={setCommentText}
                    onPostComment={handlePostComment}
                    postingComment={postingComment}
                  />
                </section>
              </div>

              <footer className="task-detail-footer">
                <div className="task-detail-footer-start">
                  {showPermissionBanner ? (
                    <div className="task-permission-hint task-permission-hint--footer" role="status">
                      <span className="task-permission-hint-icon" aria-hidden="true">
                        🔒
                      </span>
                      <p className="task-permission-hint-text">{bannerText}</p>
                    </div>
                  ) : null}
                </div>
                <div className="task-detail-footer-actions">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        className="master-btn master-btn-outline"
                        onClick={handleCancelEdit}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="master-btn master-btn-primary"
                        disabled={saving || !hasSaveableChanges}
                      >
                        {saving ? "Saving…" : "Save changes"}
                      </button>
                    </>
                  ) : hasStatusOnlyChanges ? (
                    <>
                      <button
                        type="button"
                        className="master-btn master-btn-outline"
                        onClick={handleCancelStatusChange}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="master-btn master-btn-primary"
                        disabled={saving || !hasSaveableChanges}
                      >
                        {saving ? "Saving…" : "Save changes"}
                      </button>
                    </>
                  ) : (
                    <>
                      {canEnterEditMode && !isEditing ? (
                        <button
                          type="button"
                          className="master-btn master-btn-outline"
                          onClick={() => setIsEditing(true)}
                        >
                          Edit
                        </button>
                      ) : null}
                      <button type="button" className="master-btn master-btn-outline" onClick={() => onClose?.()}>
                        Close
                      </button>
                    </>
                  )}
                </div>
              </footer>
            </form>
          )}
        </div>
      </div>
    </TaskModalPortal>
  );
}

