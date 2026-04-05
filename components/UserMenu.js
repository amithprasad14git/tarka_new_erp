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
            className="user-menu-logout"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
