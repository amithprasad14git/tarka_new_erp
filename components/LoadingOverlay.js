"use client";

/**
 * Blocks interaction and shows a spinner while mutations or fetches run (used by master and CRUD clients).
 */
export default function LoadingOverlay({ busy, label = "Please wait…" }) {
  if (!busy) return null;

  return (
    <div className="loading-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="loading-overlay-panel loading-overlay-panel--pulse">
        <div className="loading-spinner-fancy" aria-hidden>
          <span className="loading-spinner-fancy-ring loading-spinner-fancy-ring--outer" />
          <span className="loading-spinner-fancy-ring loading-spinner-fancy-ring--inner" />
          <span className="loading-spinner-fancy-dot" />
        </div>
        <span className="loading-overlay-label">{label}</span>
      </div>
    </div>
  );
}
