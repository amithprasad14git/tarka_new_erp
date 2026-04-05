"use client";

/**
 * Browser-only idle timeout (separate from server session idle in lib/session.js). After 10 minutes
 * without input, calls logout and sends the user to `/login?reason=inactive`.
 */
import { useEffect, useRef } from "react";

const INACTIVITY_LIMIT_MS = 10 * 60 * 1000;

/** Client-side idle timer: calls logout API then redirects to login. */
export default function InactivityLogout() {
  const timerRef = useRef(null);

  useEffect(() => {
    /** Clears server session and sends user to login. */
    async function logoutForInactivity() {
      try {
        // Invalidate server-side session so server requests stop authorizing this user.
        await fetch("/api/auth/logout", { method: "POST" });
      } finally {
        // Force navigation even if logout fails (prevents stale UI).
        window.location.href = "/login?reason=inactive";
      }
    }

    /** Restarts the idle countdown on user activity. */
    function resetTimer() {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      // Schedule logout after inactivity window.
      timerRef.current = setTimeout(logoutForInactivity, INACTIVITY_LIMIT_MS);
    }

    // Activity events that indicate the user is actively using the app.
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];
    events.forEach((eventName) => window.addEventListener(eventName, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      events.forEach((eventName) => window.removeEventListener(eventName, resetTimer));
    };
  }, []);

  return null;
}
