"use client";

// Dashboard modal — create a new reminder from My Reminders widget.

/**
 * Form modal to add a reminder (title, notes, due date, recurrence).
 * POST /api/reminder on save. Parent: MyRemindersWidget.js via ReminderModalPortal.
 */

import { useEffect, useId, useState } from "react";
import ReminderRecurrencePicker from "./ReminderRecurrencePicker";
import { labelWithRequiredMark } from "../../lib/formFieldLabel";
import { isDueDateOnOrAfterToday, minDueDateToday } from "./reminderUtils";
import { formatApiErrorPayload, readJsonResponse } from "../../lib/fetchClientError";
import ReminderModalPortal from "./ReminderModalPortal";

/**
 * Create-reminder dialog — resets form each time it opens.
 * @param {{ open: boolean, onClose: () => void, onCreated?: () => void }} props
 */
export default function ReminderCreateModal({ open, onClose, onCreated }) {
  const idBase = useId();
  const titleId = `${idBase}-dialog-title`;
  const reminderTitleId = `${idBase}-reminder-title`;
  const notesId = `${idBase}-notes`;
  const dueDateId = `${idBase}-due-date`;

  const [reminderTitle, setReminderTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [recurrenceType, setRecurrenceType] = useState("None");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    resetForm();
  }, [open]);

  /** Clear all fields when modal opens. */
  function resetForm() {
    setError("");
    setReminderTitle("");
    setNotes("");
    setDueDate("");
    setRecurrenceType("None");
  }

  if (!open) return null;

  /** Validate and POST new reminder to /api/reminder. */
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!String(reminderTitle).trim()) {
      setError("Reminder title is required.");
      return;
    }
    if (recurrenceType !== "None" && !dueDate) {
      setError("Due date is required for recurring reminders.");
      return;
    }
    if (dueDate && !isDueDateOnOrAfterToday(dueDate)) {
      setError("Due date cannot be in the past.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reminderTitle: reminderTitle.trim(),
          notes: notes.trim() || null,
          dueDate: dueDate || null,
          recurrenceType,
          status: "Pending"
        })
      });
      const body = await readJsonResponse(res);
      if (!res.ok) {
        setError(formatApiErrorPayload(body, "Failed to create reminder"));
        return;
      }
      onCreated?.(body);
      onClose?.();
    } catch {
      setError("Failed to create reminder");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ReminderModalPortal>
      <div className="reminder-modal-backdrop" role="presentation">
        <div
          className="reminder-modal reminder-modal--create"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <header className="reminder-modal-header reminder-modal-header--create">
            <div className="reminder-modal-heading">
              <h2 id={titleId} className="reminder-modal-title">
                Create reminder
              </h2>
              <p className="reminder-modal-subtitle">Set a follow-up for yourself with an optional recurrence.</p>
            </div>
            <button type="button" className="reminder-modal-close" onClick={() => onClose?.()} aria-label="Close">
              ×
            </button>
          </header>

          <form className="reminder-create-form master-entry-form" onSubmit={handleSubmit}>
            <div className="reminder-modal-body">
              {error ? <p className="reminder-form-error">{error}</p> : null}

              <section className="reminder-form-section">
                <div className="form-field form-field-outline">
                  <div className="form-field-outline-box">
                    <label className="form-field-outline-label" htmlFor={reminderTitleId}>
                      {labelWithRequiredMark("Title", true)}
                    </label>
                    <div className="form-field-outline-control">
                      <input
                        id={reminderTitleId}
                        type="text"
                        value={reminderTitle}
                        onChange={(e) => setReminderTitle(e.target.value)}
                        placeholder="What do you need to follow up on?"
                        required
                        autoFocus
                      />
                    </div>
                  </div>
                </div>
                <div className="form-field form-field-outline">
                  <div className="form-field-outline-box">
                    <label className="form-field-outline-label" htmlFor={notesId}>
                      Notes
                    </label>
                    <div className="form-field-outline-control">
                      <textarea
                        id={notesId}
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add context or details…"
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="reminder-form-section">
                <div className="form-field form-field-outline">
                  <div className="form-field-outline-box">
                    <label className="form-field-outline-label" htmlFor={dueDateId}>
                      {labelWithRequiredMark("Due date", recurrenceType !== "None")}
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
              </section>

              <section className="reminder-form-section">
                <span className="reminder-form-section-label">Recurrence</span>
                <ReminderRecurrencePicker value={recurrenceType} onChange={setRecurrenceType} />
              </section>
            </div>

            <footer className="reminder-modal-footer reminder-create-form-footer">
              <button type="button" className="master-btn master-btn-clear" onClick={resetForm} disabled={saving}>
                Clear
              </button>
              <button type="submit" className="master-btn master-btn-primary" disabled={saving}>
                {saving ? "Creating…" : "Create reminder"}
              </button>
            </footer>
          </form>
        </div>
      </div>
    </ReminderModalPortal>
  );
}

