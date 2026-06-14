"use client";

import { useEffect, useId, useState } from "react";
import LookupSelect from "../LookupSelect";
import TaskPriorityPicker from "./TaskPriorityPicker";
import { labelWithRequiredMark } from "../../lib/formFieldLabel";
import { isDueDateOnOrAfterToday, minDueDateToday } from "./taskUtils";
import { formatApiErrorPayload, readJsonResponse } from "../../lib/fetchClientError";
import TaskModalPortal from "./TaskModalPortal";

export default function TaskCreateModal({ open, onClose, onCreated }) {
  const idBase = useId();
  const titleId = `${idBase}-dialog-title`;
  const taskTitleId = `${idBase}-task-title`;
  const descriptionId = `${idBase}-description`;
  const assigneeId = `${idBase}-assignee`;
  const followUpId = `${idBase}-follow-up`;
  const dueDateId = `${idBase}-due-date`;

  const [taskTitle, setTaskTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState("");
  const [followUpPerson, setFollowUpPerson] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    resetForm();
  }, [open]);

  function resetForm() {
    setError("");
    setTaskTitle("");
    setDescription("");
    setAssignee("");
    setFollowUpPerson("");
    setDueDate("");
    setPriority("Medium");
  }

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!String(taskTitle).trim()) {
      setError("Task title is required.");
      return;
    }
    if (!assignee) {
      setError("Assignee is required.");
      return;
    }
    if (followUpPerson && Number(followUpPerson) === Number(assignee)) {
      setError("Follow-up person cannot be the same as the assignee.");
      return;
    }
    if (dueDate && !isDueDateOnOrAfterToday(dueDate)) {
      setError("Due date cannot be in the past.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskTitle: taskTitle.trim(),
          description: description.trim() || null,
          assignee: Number(assignee),
          followUpPerson: followUpPerson ? Number(followUpPerson) : null,
          dueDate: dueDate || null,
          priority,
          status: "Pending"
        })
      });
      const body = await readJsonResponse(res);
      if (!res.ok) {
        setError(formatApiErrorPayload(body, "Failed to create task"));
        return;
      }
      onCreated?.(body);
      onClose?.();
    } catch {
      setError("Failed to create task");
    } finally {
      setSaving(false);
    }
  }

  return (
    <TaskModalPortal>
      <div className="task-modal-backdrop" role="presentation">
      <div
        className="task-modal task-modal--create"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="task-modal-header task-modal-header--create">
          <div className="task-modal-heading">
            <h2 id={titleId} className="task-modal-title">
              Create task
            </h2>
            <p className="task-modal-subtitle">Capture what needs to be done and who owns it.</p>
          </div>
          <button type="button" className="task-modal-close" onClick={() => onClose?.()} aria-label="Close">
            ×
          </button>
        </header>

        <form className="task-create-form master-entry-form" onSubmit={handleSubmit}>
          <div className="task-modal-body">
            {error ? <p className="task-form-error">{error}</p> : null}

            <section className="task-form-section">
              <span className="task-form-section-label">Details</span>
              <div className="form-field form-field-outline">
                <div className="form-field-outline-box">
                  <label className="form-field-outline-label" htmlFor={taskTitleId}>
                    {labelWithRequiredMark("Task name", true)}
                  </label>
                  <div className="form-field-outline-control">
                    <input
                      id={taskTitleId}
                      type="text"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      placeholder="Brief summary of the task…"
                      required
                      autoFocus
                    />
                  </div>
                </div>
              </div>
              <div className="form-field form-field-outline">
                <div className="form-field-outline-box">
                  <label className="form-field-outline-label" htmlFor={descriptionId}>
                    Description
                  </label>
                  <div className="form-field-outline-control">
                    <textarea
                      id={descriptionId}
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Add details, context, or links…"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="task-form-section">
              <span className="task-form-section-label">People</span>
              <div className="task-field-row task-field-row--people">
                <div className="form-field form-field-outline">
                  <div className="form-field-outline-box">
                    <label className="form-field-outline-label" htmlFor={assigneeId}>
                      {labelWithRequiredMark("Assignee", true)}
                    </label>
                    <div className="form-field-outline-control">
                      <LookupSelect
                        name="assignee"
                        id={assigneeId}
                        fieldLabel="Assignee"
                        required
                        lookup={{
                          module: "users",
                          valueField: "id",
                          labelField: "fullName",
                          extraLovParams: { f_active: "Yes" }
                        }}
                        initialValue={assignee}
                        onValueChange={(v) => setAssignee(v)}
                      />
                    </div>
                  </div>
                </div>
                <div className="form-field form-field-outline">
                  <div className="form-field-outline-box">
                    <label className="form-field-outline-label" htmlFor={followUpId}>
                      Follow-up person
                    </label>
                    <div className="form-field-outline-control">
                      <LookupSelect
                        name="followUpPerson"
                        id={followUpId}
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
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="task-form-section">
              <span className="task-form-section-label">Schedule</span>
              <div className="task-field-row task-field-row--schedule">
                <div className="form-field form-field-outline">
                  <div className="form-field-outline-box">
                    <label className="form-field-outline-label" htmlFor={dueDateId}>
                      Due date
                    </label>
                    <div className="form-field-outline-control">
                      <input
                        id={dueDateId}
                        type="date"
                        value={dueDate}
                        min={minDueDateToday()}
                        onChange={(e) => setDueDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="form-field form-field-outline">
                  <div className="form-field-outline-box">
                    <span className="form-field-outline-label">Priority</span>
                    <div className="form-field-outline-control">
                      <TaskPriorityPicker value={priority} onChange={setPriority} />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <footer className="task-modal-footer task-create-form-footer">
            <button type="button" className="master-btn master-btn-clear" onClick={resetForm} disabled={saving}>
              Clear
            </button>
            <button type="submit" className="master-btn master-btn-primary" disabled={saving}>
              {saving ? "Creating…" : "Create task"}
            </button>
          </footer>
        </form>
      </div>
      </div>
    </TaskModalPortal>
  );
}
