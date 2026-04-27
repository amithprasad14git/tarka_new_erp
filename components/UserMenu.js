"use client";

/**
 * Top-right avatar dropdown: shows email and triggers POST `/api/auth/logout` before navigating away.
 */
import { useEffect, useRef, useState } from "react";

function initialsFromEmail(email) {
  // Convert email into 1-2 initials for a compact avatar.
  if (!email) return "?";
  const local = email.split("@")[0] || email;
  const parts = local.replace(/[^a-zA-Z0-9]/g, " ").trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  }
  return local.slice(0, 2).toUpperCase();
}

/**
 * Avatar opens a popover with email and logout (Flux-style header).
 * @param {{ email: string }} props
 */
export default function UserMenu({ email }) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
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
    setShowChangePassword(true);
    setPasswordMessage({ kind: "", text: "" });
    setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setPasswordVisibility({ currentPassword: false, newPassword: false, confirmPassword: false });
  }

  async function handleChangePasswordSubmit(e) {
    e.preventDefault();
    setPasswordMessage({ kind: "", text: "" });
    setChangingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwordForm)
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to change password.");
      setPasswordMessage({ kind: "success", text: payload?.message || "Password changed successfully." });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setShowChangePassword(false);
    } catch (err) {
      setPasswordMessage({ kind: "error", text: err.message || "Failed to change password." });
    } finally {
      setChangingPassword(false);
    }
  }

  const initials = initialsFromEmail(email);

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
              <div className="user-menu-email" title={email}>
                {email}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="user-menu-change-password-btn"
            onClick={openChangePassword}
            disabled={changingPassword || loggingOut}
          >
            Change Password
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
              <div className="user-menu-password-actions">
                <button
                  type="button"
                  className="user-menu-password-cancel"
                  onClick={() => setShowChangePassword(false)}
                  disabled={changingPassword}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="user-menu-password-save"
                  disabled={changingPassword}
                >
                  {changingPassword ? "Updating..." : "Update"}
                </button>
              </div>
            </form>
          ) : null}
          <button
            type="button"
            className="user-menu-logout user-menu-logout-danger"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? "Logging out..." : "Logout"}
          </button>
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
