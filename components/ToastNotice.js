"use client";

// Generic/shared file used across modules.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Fixed banner for success/error feedback after save/delete (master module); uses global `.toast*` CSS classes.
 * @param {{ toast: { kind: "success"|"error", message: string } | null, onClose: () => void }} props
 */
export default function ToastNotice({ toast, onClose }) {
  if (!toast) return null;
  const isError = toast.kind === "error";

  return (
    // Fixed banner at bottom of screen; errors use alert role for screen readers.
    <div
      className={`toast toast-${toast.kind}`}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
    >
      <div className="toast-message">{toast.message}</div>
      <button type="button" className="toast-ok" onClick={onClose} aria-label="Close notification">
        OK
      </button>
    </div>
  );
}


