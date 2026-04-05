"use client";

/**
 * Fixed banner for success/error feedback after save/delete (master module); uses global `.toast*` CSS classes.
 * @param {{ toast: { kind: "success"|"error", message: string } | null, onClose: () => void }} props
 */
export default function ToastNotice({ toast, onClose }) {
  if (!toast) return null;

  return (
    // Uses global `.toast*` CSS classes so other modules can reuse this component.
    <div className={`toast toast-${toast.kind}`} role="status" aria-live="polite">
      <div className="toast-message">{toast.message}</div>
      <button type="button" className="toast-ok" onClick={onClose} aria-label="Close notification">
        OK
      </button>
    </div>
  );
}

