"use client";

// Generic/shared file used across modules.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Top-right avatar dropdown: shows full name and triggers POST `/api/auth/logout` before navigating away.
 */
import { useEffect, useRef, useState } from "react";
import {
  formatApiErrorPayload,
  formatUserFacingError,
  readJsonResponse
} from "../lib/fetchClientError";
import { apiUserMessage } from "../lib/apiUserMessages";
import { PASSWORD_POLICY_HELPER_TEXT, validateNewPassword } from "../lib/passwordPolicy";

function initialsFromIdentity(fullName, username) {
  const name = String(fullName || "").trim();
  if (name) {
    const parts = name.replace(/[^a-zA-Z0-9]/g, " ").trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
    }
    return parts[0]?.slice(0, 2).toUpperCase() || "?";
  }
  const user = String(username || "").trim();
  if (!user) return "?";
  const parts = user.replace(/[^a-zA-Z0-9]/g, " ").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  }
  return user.slice(0, 2).toUpperCase();
}

/**
 * Avatar opens a popover with full name and logout (Flux-style header).
 * @param {{ username: string, fullName?: string }} props
 */
export default function UserMenu({ username, fullName = "" }) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  // Inline change-password card state inside the user popover.
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [passwordVisibility, setPasswordVisibility] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false
  });
  const [passwordMessage, setPasswordMessage] = useState({ kind: "", text: "" });
  const [logoutSwipeKey, setLogoutSwipeKey] = useState(0);
  const wrapRef = useRef(null);

  useEffect(() => {
    // Click-away behavior: closes the popover when clicking outside.
    function onDocClick(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onDocClick);
      return () => document.removeEventListener("mousedown", onDocClick);
    }
    setLogoutSwipeKey((k) => k + 1);
  }, [open]);

  async function handleLogout() {
    // Disable button while logout API call is running.
    setLoggingOut(true);
    try {
      // Server clears session cookie/row; client then navigates to login.
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } finally {
      setLoggingOut(false);
    }
  }

  function openChangePassword() {
    // Always reset old values/messages so every attempt starts clean.
    setShowChangePassword(true);
    setPasswordMessage({ kind: "", text: "" });
    setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setPasswordVisibility({ currentPassword: false, newPassword: false, confirmPassword: false });
  }

  async function handleChangePasswordSubmit(e) {
    e.preventDefault();
    setPasswordMessage({ kind: "", text: "" });

    const policyError = validateNewPassword(passwordForm.newPassword, { username });
    if (policyError) {
      setPasswordMessage({ kind: "error", text: policyError });
      return;
    }

    setChangingPassword(true);
    try {
      // Server verifies current password before accepting the new one.
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordForm)
      });
      const payload = await readJsonResponse(res);
      if (!res.ok) {
        throw new Error(formatApiErrorPayload(payload, apiUserMessage("changePassword")));
      }
      // Success path: show toast-like message and close form.
      setPasswordMessage({ kind: "success", text: payload?.message || "Password changed successfully." });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setShowChangePassword(false);
    } catch (err) {
      setPasswordMessage({
        kind: "error",
        text: formatUserFacingError(err, { fallback: apiUserMessage("changePassword") })
      });
    } finally {
      setChangingPassword(false);
    }
  }

  const initials = initialsFromIdentity(fullName, username);
  const signedInAs = String(fullName || username || "").trim();

  return (
    <div className="user-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        className="user-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        title="Account"
      >
        <span className="user-menu-avatar" aria-hidden>
          {initials}
        </span>
      </button>
      {open ? (
        <div className="user-menu-popover" role="dialog" aria-label="Account menu">
          <div className="user-menu-header">
            <span className="user-menu-avatar user-menu-avatar-lg" aria-hidden>
              {initials}
            </span>
            <div className="user-menu-text">
              <div className="user-menu-label">Signed in as</div>
              <div className="user-menu-email" title={signedInAs}>
                {signedInAs || "—"}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="user-menu-change-password-btn user-menu-action-btn"
            onClick={openChangePassword}
            disabled={changingPassword || loggingOut}
          >
            <ChangePasswordIcon />
            <span>Change Password</span>
          </button>
          {passwordMessage.text ? (
            <div
              className={
                passwordMessage.kind === "success"
                  ? "user-menu-password-message user-menu-password-message-success"
                  : "user-menu-password-message user-menu-password-message-error"
              }
              role="status"
            >
              {passwordMessage.text}
            </div>
          ) : null}
          {showChangePassword ? (
            <form className="user-menu-password-form" onSubmit={handleChangePasswordSubmit}>
              <label className="user-menu-password-label" htmlFor="current-password">
                Current Password
              </label>
              <div className="user-menu-password-row">
                <input
                  id="current-password"
                  type={passwordVisibility.currentPassword ? "text" : "password"}
                  className="user-menu-password-input"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))
                  }
                  required
                />
                <button
                  type="button"
                  className="user-menu-password-toggle"
                  onClick={() =>
                    setPasswordVisibility((prev) => ({
                      ...prev,
                      currentPassword: !prev.currentPassword
                    }))
                  }
                  aria-label={passwordVisibility.currentPassword ? "Hide password" : "Show password"}
                >
                  {passwordVisibility.currentPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              <label className="user-menu-password-label" htmlFor="new-password">
                New Password
              </label>
              <div className="user-menu-password-row">
                <input
                  id="new-password"
                  type={passwordVisibility.newPassword ? "text" : "password"}
                  className="user-menu-password-input"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))
                  }
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  className="user-menu-password-toggle"
                  onClick={() =>
                    setPasswordVisibility((prev) => ({
                      ...prev,
                      newPassword: !prev.newPassword
                    }))
                  }
                  aria-label={passwordVisibility.newPassword ? "Hide password" : "Show password"}
                >
                  {passwordVisibility.newPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              <label className="user-menu-password-label" htmlFor="confirm-password">
                Confirm New Password
              </label>
              <div className="user-menu-password-row">
                <input
                  id="confirm-password"
                  type={passwordVisibility.confirmPassword ? "text" : "password"}
                  className="user-menu-password-input"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                  }
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  className="user-menu-password-toggle"
                  onClick={() =>
                    setPasswordVisibility((prev) => ({
                      ...prev,
                      confirmPassword: !prev.confirmPassword
                    }))
                  }
                  aria-label={passwordVisibility.confirmPassword ? "Hide password" : "Show password"}
                >
                  {passwordVisibility.confirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              <div className="user-menu-password-logic">
                <p className="user-menu-password-logic-title">Password Logic</p>
                <p className="user-menu-password-hint">{PASSWORD_POLICY_HELPER_TEXT}</p>
              </div>
              <div className="user-menu-password-actions">
                <button
                  type="button"
                  className="user-menu-password-cancel user-menu-action-btn"
                  onClick={() => setShowChangePassword(false)}
                  disabled={changingPassword}
                >
                  <CancelIcon />
                  <span>Cancel</span>
                </button>
                <button
                  type="submit"
                  className="user-menu-password-save user-menu-action-btn"
                  disabled={changingPassword}
                >
                  <UpdateIcon />
                  <span>{changingPassword ? "Updating..." : "Update"}</span>
                </button>
              </div>
            </form>
          ) : null}
          <SwipeToLogout
            key={logoutSwipeKey}
            onLogout={handleLogout}
            disabled={loggingOut || changingPassword}
            loggingOut={loggingOut}
          />
        </div>
      ) : null}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function ChangePasswordIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function CancelIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6M9 9l6 6" />
    </svg>
  );
}

function UpdateIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function SwipeChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

const SWIPE_LOGOUT_THRESHOLD = 0.88;

function SwipeToLogout({ onLogout, disabled = false, loggingOut = false }) {
  const trackRef = useRef(null);
  const thumbRef = useRef(null);
  const dragXRef = useRef(0);
  const maxDragRef = useRef(0);
  const pointerIdRef = useRef(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [completed, setCompleted] = useState(false);

  function measureMaxDrag() {
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!track || !thumb) return 0;
    const styles = getComputedStyle(track);
    const padX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
    return Math.max(0, track.clientWidth - thumb.offsetWidth - padX);
  }

  function setDragPosition(nextX, { animate = false } = {}) {
    const maxDrag = maxDragRef.current || measureMaxDrag();
    maxDragRef.current = maxDrag;
    const clamped = Math.max(0, Math.min(nextX, maxDrag));
    dragXRef.current = clamped;
    setDragX(clamped);
    if (thumbRef.current) {
      thumbRef.current.style.transition = animate ? "transform 0.2s ease" : "none";
      thumbRef.current.style.transform = `translateX(${clamped}px)`;
    }
  }

  function resetThumb({ animate = true } = {}) {
    if (completed || loggingOut) return;
    setDragPosition(0, { animate });
  }

  function completeLogout() {
    if (disabled || completed || loggingOut) return;
    setCompleted(true);
    setDragPosition(maxDragRef.current, { animate: true });
    onLogout();
  }

  function onPointerDown(e) {
    if (disabled || completed || loggingOut) return;
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    maxDragRef.current = measureMaxDrag();
    pointerIdRef.current = e.pointerId;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (pointerIdRef.current === null || pointerIdRef.current !== e.pointerId) return;
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const thumbWidth = thumbRef.current?.offsetWidth ?? 36;
    const pad = 4;
    const nextX = e.clientX - rect.left - pad - thumbWidth / 2;
    setDragPosition(nextX);
  }

  function onPointerUp(e) {
    if (pointerIdRef.current !== e.pointerId) return;
    pointerIdRef.current = null;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const maxDrag = maxDragRef.current || measureMaxDrag();
    if (maxDrag > 0 && dragXRef.current >= maxDrag * SWIPE_LOGOUT_THRESHOLD) {
      completeLogout();
      return;
    }
    resetThumb({ animate: true });
  }

  useEffect(() => {
    maxDragRef.current = measureMaxDrag();
    const onResize = () => {
      maxDragRef.current = measureMaxDrag();
      if (!dragging && !completed && !loggingOut) {
        setDragPosition(dragXRef.current, { animate: false });
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [dragging, completed, loggingOut]);

  const label = loggingOut ? "Logging out..." : completed ? "Logging out..." : "Swipe to logout";

  return (
    <div
      ref={trackRef}
      className={[
        "user-menu-swipe-logout",
        dragging ? "is-dragging" : "",
        completed || loggingOut ? "is-active" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Swipe to logout"
      role="group"
    >
      <span className="user-menu-swipe-label" aria-hidden="true">
        {label}
      </span>
      <button
        ref={thumbRef}
        type="button"
        className="user-menu-swipe-thumb"
        style={{ transform: `translateX(${dragX}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        disabled={disabled || completed || loggingOut}
        aria-label={label}
      >
        {loggingOut || completed ? <LogoutIcon /> : <SwipeChevronIcon />}
      </button>
    </div>
  );
}

