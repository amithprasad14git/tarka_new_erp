"use client";

/**
 * Collapsible “Actions” menu in the master header: mirrors bottom-bar save/view/clear with RBAC-aware disables.
 */
import { useRef } from "react";

function SaveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v4h5" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M7 6l1 16h8l1-16" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/**
 * Sticky header actions: same Save / View / Clear Screen as the bottom bar (RBAC + readOnly).
 */
export default function MasterActionsMenu({
  formId,
  busy,
  readOnly,
  entryMode,
  editingRow,
  canCreate,
  canEdit,
  canSaveThisRow = true,
  canView,
  onView,
  onClear
}) {
  const detailsRef = useRef(null);

  function closeMenu() {
    if (detailsRef.current) detailsRef.current.open = false;
  }

  const clearDisabled = busy;
  const showSave =
    !readOnly && entryMode && (editingRow ? canEdit && canSaveThisRow : canCreate);
  const showView = !readOnly && entryMode && canView;

  return (
    <details ref={detailsRef} className="master-actions-details">
      <summary className="master-actions-summary master-btn master-btn-primary" title="Open actions menu">
        Actions
        <ChevronIcon />
      </summary>
      <div className="master-actions-panel" role="menu">
        {entryMode ? (
          <>
            {showSave ? (
              <button
                type="submit"
                form={formId}
                className="master-actions-item master-btn master-btn-primary"
                disabled={busy}
                role="menuitem"
                onClick={closeMenu}
              >
                <SaveIcon />
                Save
              </button>
            ) : null}
            {showView ? (
              <button
                type="button"
                className="master-actions-item master-btn master-btn-info"
                disabled={busy}
                role="menuitem"
                onClick={() => {
                  closeMenu();
                  onView();
                }}
              >
                <EyeIcon />
                View
              </button>
            ) : null}
          </>
        ) : null}
        <button
          type="button"
          className="master-actions-item master-btn master-btn-warning"
          disabled={clearDisabled}
          role="menuitem"
          onClick={() => {
            closeMenu();
            onClear();
          }}
        >
          <ClearIcon />
          Clear Screen
        </button>
      </div>
    </details>
  );
}
