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

  return (
    <TaskModalPortal>
      <div className="task-modal-backdrop" role="presentation">
        <div
          className="task-modal task-modal--detail-enterprise"
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
              <header className="task-detail-modal-header">
                <h2 id={dialogTitleId} className="task-detail-modal-title">
                  Task Details
                </h2>
                <button
                  type="button"
                  className="task-detail-modal-close"
                  onClick={() => onClose?.()}
                  aria-label="Close"
                >
                  ×
                </button>
              </header>

              {error ? <p className="task-form-error task-form-error--detail">{error}</p> : null}

              <div className="task-detail-body">
                <section className="task-detail-details">
                  <div className="task-detail-details-card">
                    {fieldsEditable ? (
                      <input
                        id={titleId}
                        type="text"
                        className="task-detail-title-input"
                        value={taskTitle}
                        onChange={(e) => setTaskTitle(e.target.value)}
                        placeholder="Brief summary of the task…"
                        aria-label="Task name"
                        required
                      />
                    ) : (
                      <h2 id={titleId} className="task-detail-title">
                        {task?.taskTitle || "Task"}
                      </h2>
                    )}

                    {fieldsEditable ? (
                      <textarea
                        className="task-textarea task-detail-description-input"
                        rows={2}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Add details, context, or links…"
                        aria-label="Description"
                      />
                    ) : task?.description ? (
                      <p className="task-detail-description task-detail-description--prose">{task.description}</p>
                    ) : (
                      <p className="task-empty-inline task-detail-description-empty">No description provided.</p>
                    )}
                  </div>
                </section>

                <aside className="task-detail-meta-panel">
                  <div className="task-detail-meta-card">
                    <div className="task-detail-meta-group">
                      <div className="task-detail-property">
                        <h3 className="task-detail-property-label">Status</h3>
                        <div className="task-detail-property-value">
                          {statusEditable ? (
                            <TaskStatusPills value={status} onChange={setStatus} />
                          ) : (
                            <TaskStatusBadge status={task?.status} />
                          )}
                        </div>
                      </div>

                      <div className="task-detail-property">
                        <h3 className="task-detail-property-label">Priority</h3>
                        <div className="task-detail-property-value">
                          <TaskPriorityPicker
                            value={priority}
                            onChange={setPriority}
                            readOnly={!fieldsEditable}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="task-detail-meta-group">
                      <div className="task-detail-property">
                        <h3 className="task-detail-property-label">Due date</h3>
                        <div className="task-detail-property-value">
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

                      <div className="task-detail-property">
                        <h3 className="task-detail-property-label">Days past due</h3>
                        <div className="task-detail-property-value">
                          <DaysPastDueDisplay dueDate={effectiveDueDate} status={effectiveStatus} />
                        </div>
                      </div>
                    </div>

                    <div className="task-detail-meta-group">
                      <div className="task-detail-property">
                        <h3 className="task-detail-property-label">Assignee</h3>
                        <div className="task-detail-property-value">
                          <div className="task-detail-person">
                            <TaskAvatar name={task?.assigneeLabel} size="sm" />
                            <span>{task?.assigneeLabel || "—"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="task-detail-property">
                        <h3 className="task-detail-property-label">Follow-up person</h3>
                        <div className="task-detail-property-value">
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
                    </div>

                    <div className="task-detail-meta-group">
                      <div className="task-detail-property">
                        <h3 className="task-detail-property-label">Assigned by</h3>
                        <div className="task-detail-property-value">
                          <div className="task-detail-person">
                            <TaskAvatar name={task?.createdByLabel} size="sm" />
                            <span>{task?.createdByLabel || "—"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="task-detail-property">
                        <h3 className="task-detail-property-label">Created</h3>
                        <div className="task-detail-property-value">
                          <p className="task-detail-meta-value">
                            {task?.createdDate ? formatTaskDate(String(task.createdDate).slice(0, 10)) : "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </aside>

                <div className="task-detail-feed">
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
                </div>
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
