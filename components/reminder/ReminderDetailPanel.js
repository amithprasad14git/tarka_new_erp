"use client";

// Dashboard modal — view/edit a single reminder from list or widget.

/**
 * Side panel / modal for one reminder: details form, status pills, activity feed.
 * GET/PATCH /api/reminder/:id. Respects completed-lock permissions banner.
 * Parent: MyRemindersWidget.js via ReminderModalPortal.
 */

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import ReminderActivityList from "./ReminderActivityList";
import ReminderRecurrencePicker from "./ReminderRecurrencePicker";
import ReminderStatusPills from "./ReminderStatusPills";
import ReminderStatusBadge from "./ReminderStatusBadge";
import {
  daysPastDue,
  formatReminderDate,
  isDueDateOnOrAfterToday,
  overdueDaysSeverity
} from "./reminderUtils";
import { labelWithRequiredMark } from "../../lib/formFieldLabel";
import { formatApiErrorPayload, readJsonResponse } from "../../lib/fetchClientError";
import ReminderModalPortal from "./ReminderModalPortal";

/** Plain-English banner when user cannot edit a completed reminder. */
function permissionBannerText(permissions) {
  if (!permissions) return null;
  if (permissions.isCompletedLocked) {
    return "This reminder is completed. Only an administrator can make changes.";
  }
  return null;
}

/** Normalize API due date to YYYY-MM-DD for date input. */
function dueDateValue(raw) {
  if (!raw) return "";
  return String(raw).slice(0, 10);
}

/** Overdue days readout in reminder detail header. */
function DaysPastDueDisplay({ dueDate, status }) {
  const days = daysPastDue(dueDate, status);
  const severity = overdueDaysSeverity(days);
  if (days == null || days <= 0) {
    return <p className="reminder-detail-meta-value">—</p>;
  }
  return (
    <p className={`reminder-detail-meta-value reminder-group-overdue reminder-group-overdue--${severity}`}>{days}d</p>
  );
}

/** Hydrate form state from GET /api/reminder/:id response. */
function resetFormFromReminder(data, setters) {
  setters.setReminder(data);
  setters.setPermissions(data.permissions || null);
  setters.setReminderTitle(data.reminderTitle || "");
  setters.setNotes(data.notes || "");
  setters.setDueDate(dueDateValue(data.dueDate));
  setters.setRecurrenceType(data.recurrenceType || "None");
  setters.setStatus(data.status || "Pending");
}

/**
 * Reminder detail/edit dialog — loads by reminderId when open.
 * @param {{ open: boolean, reminderId: number | string | null, onClose: () => void, onUpdated?: () => void }} props
 */
export default function ReminderDetailPanel({ open, reminderId, onClose, onUpdated }) {
  const dialogTitleId = useId();
  const titleId = useId();
  const notesId = useId();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [reminder, setReminder] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [activity, setActivity] = useState([]);
  const [reminderTitle, setReminderTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [recurrenceType, setRecurrenceType] = useState("None");
  const [status, setStatus] = useState("");

  const formSetters = useMemo(
    () => ({
      setReminder,
      setPermissions,
      setReminderTitle,
      setNotes,
      setDueDate,
      setRecurrenceType,
      setStatus
    }),
    []
  );

  const reloadFormFromReminder = useCallback(
    (data) => {
      resetFormFromReminder(data, formSetters);
    },
    [formSetters]
  );

  const loadReminder = useCallback(async () => {
    if (!reminderId) return null;
    const res = await fetch(`/api/reminder/${encodeURIComponent(reminderId)}`, { cache: "no-store" });
    const body = await readJsonResponse(res);
    if (!res.ok) {
      throw new Error(formatApiErrorPayload(body, "Failed to load reminder"));
    }
    return body;
  }, [reminderId]);

  useEffect(() => {
    if (!open || !reminderId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      setSuccessMsg("");
      try {
        const body = await loadReminder();
        if (cancelled || !body) return;
        const data = body.data || {};
        reloadFormFromReminder(data);
        setActivity(body.childTableRows?.activity_log || []);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load reminder");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, reminderId, loadReminder, reloadFormFromReminder]);

  const isCompletedLocked = Boolean(permissions?.isCompletedLocked);
  const canEditDetails = Boolean(permissions?.canEditDetails);
  const canUpdateStatus = Boolean(permissions?.canUpdateStatus);

  const fieldsEditable = canEditDetails && !isCompletedLocked;
  const statusEditable = canUpdateStatus && !isCompletedLocked;

  const bannerText = permissionBannerText(permissions);
  const showPermissionBanner = Boolean(bannerText);

  const hasDetailChanges = useMemo(() => {
    if (!reminder || !canEditDetails) return false;
    return (
      reminderTitle.trim() !== (reminder.reminderTitle || "").trim() ||
      (notes || "").trim() !== (reminder.notes || "").trim() ||
      dueDate !== dueDateValue(reminder.dueDate) ||
      recurrenceType !== (reminder.recurrenceType || "None")
    );
  }, [reminder, canEditDetails, reminderTitle, notes, dueDate, recurrenceType]);

  const hasStatusChanges = useMemo(() => {
    if (!reminder || !canUpdateStatus) return false;
    return status !== (reminder.status || "Pending");
  }, [reminder, canUpdateStatus, status]);

  const hasSaveableChanges = hasDetailChanges || hasStatusChanges;

  function handleCancelEdit() {
    if (reminder) reloadFormFromReminder(reminder);
    setError("");
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!hasSaveableChanges) return;
    const currentDueDate = dueDateValue(reminder?.dueDate);
    const dueDateChanged = dueDate !== currentDueDate;
    const recurrenceChanged = recurrenceType !== (reminder?.recurrenceType || "None");

    if (canEditDetails && recurrenceChanged && recurrenceType !== "None" && !dueDate) {
      setError("Due date is required for recurring reminders.");
      return;
    }
    if (canEditDetails && dueDateChanged && dueDate && !isDueDateOnOrAfterToday(dueDate)) {
      setError("Due date cannot be in the past.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccessMsg("");
    try {
      const payload = {};
      if (canEditDetails) {
        if (reminderTitle.trim() !== (reminder?.reminderTitle || "").trim()) {
          payload.reminderTitle = reminderTitle.trim();
        }
        if ((notes || "").trim() !== (reminder?.notes || "").trim()) {
          payload.notes = notes.trim() || null;
        }
        if (dueDate !== dueDateValue(reminder?.dueDate)) payload.dueDate = dueDate || null;
        if (recurrenceType !== (reminder?.recurrenceType || "None")) payload.recurrenceType = recurrenceType;
      }
      if (canUpdateStatus && status !== (reminder?.status || "Pending")) {
        payload.status = status;
      }

      const res = await fetch(`/api/reminder/${encodeURIComponent(reminderId)}`, {
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

  if (!open) return null;

  const effectiveDueDate = dueDate || (reminder?.dueDate ? String(reminder.dueDate).slice(0, 10) : "");

  return (
    <ReminderModalPortal>
      <div className="reminder-modal-backdrop" role="presentation">
        <div
          className="reminder-modal reminder-modal--detail-enterprise"
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
          onClick={(e) => e.stopPropagation()}
        >
          {loading ? (
            <div className="reminder-detail-loading">
              <p className="reminder-empty-state">Loading reminder…</p>
            </div>
          ) : (
            <form className="reminder-detail-form master-entry-form" onSubmit={handleSave}>
              <header className="reminder-detail-modal-header">
                <h2 id={dialogTitleId} className="reminder-detail-modal-title">
                  Reminder Details
                </h2>
                <button
                  type="button"
                  className="reminder-detail-modal-close"
                  onClick={() => onClose?.()}
                  aria-label="Close"
                >
                  ×
                </button>
              </header>

              <div className="reminder-detail-body">
                <section className="reminder-detail-details">
                  <div className="reminder-detail-details-card">
                    {fieldsEditable ? (
                      <>
                        <div className="form-field form-field-outline">
                          <div className="form-field-outline-box">
                            <label className="form-field-outline-label" htmlFor={titleId}>
                              {labelWithRequiredMark("Title", true)}
                            </label>
                            <div className="form-field-outline-control">
                              <input
                                id={titleId}
                                type="text"
                                value={reminderTitle}
                                onChange={(e) => setReminderTitle(e.target.value)}
                                placeholder="What do you need to follow up on?"
                                required
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
                      </>
                    ) : (
                      <>
                        <h2 id={titleId} className="reminder-detail-title">
                          {reminder?.reminderTitle || "Reminder"}
                        </h2>

                        {reminder?.notes ? (
                          <p className="reminder-detail-description reminder-detail-description--prose">{reminder.notes}</p>
                        ) : (
                          <p className="reminder-empty-inline reminder-detail-description-empty">No notes provided.</p>
                        )}
                      </>
                    )}
                  </div>
                </section>

                <aside className="reminder-detail-meta-panel">
                  <div className="reminder-detail-meta-card">
                    <div className="reminder-detail-meta-group">
                      <div className="reminder-detail-property">
                        <h3 className="reminder-detail-property-label">Status</h3>
                        <div className="reminder-detail-property-value">
                          {statusEditable ? (
                            <ReminderStatusPills value={status} onChange={setStatus} />
                          ) : (
                            <ReminderStatusBadge status={reminder?.status} />
                          )}
                        </div>
                      </div>

                      <div className="reminder-detail-property">
                        <h3 className="reminder-detail-property-label">Recurrence</h3>
                        <div className="reminder-detail-property-value">
                          {fieldsEditable ? (
                            <ReminderRecurrencePicker value={recurrenceType} onChange={setRecurrenceType} />
                          ) : (
                            <p className="reminder-detail-meta-value">{reminder?.recurrenceType || "None"}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="reminder-detail-meta-group">
                      <div className="reminder-detail-property">
                        <h3 className="reminder-detail-property-label">Due date</h3>
                        <div className="reminder-detail-property-value">
                          {fieldsEditable ? (
                            <input
                              type="date"
                              className="reminder-input"
                              value={dueDate}
                              onChange={(e) => setDueDate(e.target.value)}
                            />
                          ) : (
                            <p className="reminder-detail-meta-value">
                              {reminder?.dueDate ? formatReminderDate(reminder.dueDate) : "—"}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="reminder-detail-property">
                        <h3 className="reminder-detail-property-label">Days past due</h3>
                        <div className="reminder-detail-property-value">
                          <DaysPastDueDisplay dueDate={effectiveDueDate} status={reminder?.status} />
                        </div>
                      </div>
                    </div>
                  </div>
                </aside>

                <div className="reminder-detail-feed">
                  <div className="reminder-detail-feed-card">
                    <h3 className="reminder-detail-section-title">Activity</h3>
                    <ReminderActivityList rows={activity} />
                  </div>
                </div>
              </div>

              {(showPermissionBanner || hasSaveableChanges || error || successMsg) ? (
                <footer className="reminder-detail-footer">
                  <div className="reminder-detail-footer-start">
                    {error ? (
                      <p className="reminder-form-error reminder-form-error--footer" role="alert">
                        {error}
                      </p>
                    ) : successMsg ? (
                      <p className="reminder-form-success reminder-form-success--footer" role="status">
                        {successMsg}
                      </p>
                    ) : showPermissionBanner ? (
                      <div className="reminder-permission-hint reminder-permission-hint--footer" role="status">
                        <span className="reminder-permission-hint-icon" aria-hidden="true">
                          🔒
                        </span>
                        <p className="reminder-permission-hint-text">{bannerText}</p>
                      </div>
                    ) : null}
                  </div>
                  {hasSaveableChanges ? (
                    <div className="reminder-detail-footer-actions">
                      <button type="button" className="master-btn master-btn-outline" onClick={handleCancelEdit} disabled={saving}>
                        Cancel
                      </button>
                      <button type="submit" className="master-btn master-btn-primary" disabled={saving}>
                        {saving ? "Saving…" : "Save changes"}
                      </button>
                    </div>
                  ) : null}
                </footer>
              ) : null}
            </form>
          )}
        </div>
      </div>
    </ReminderModalPortal>
  );
}
