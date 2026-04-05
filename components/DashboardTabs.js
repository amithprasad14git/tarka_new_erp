"use client";

/**
 * URL-driven tabs under `/dashboard/:module`: keeps inactive modules mounted (state preserved) while
 * syncing the address bar for refresh and back/forward. Most tabs use `MasterModuleClient`;
 * `user_permissions` uses `UserPermissionsMatrixClient`.
 */
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { modules } from "../config/modules";
import MasterModuleClient from "./MasterModuleClient";
import UserPermissionsMatrixClient from "./UserPermissionsMatrixClient";

function extractModuleKey(pathname) {
  // Expected patterns: /dashboard/<module> or /dashboard/<module>/*
  const parts = String(pathname || "").split("/").filter(Boolean);
  if (parts.length < 2) return null;
  if (parts[0] !== "dashboard") return null;
  return parts[1] || null;
}

/**
 * In-page dashboard tabs: keeps multiple module screens mounted so users can multitask.
 * @param {{ visibleModuleKeys: string[] }} props
 */
export default function DashboardTabs({ visibleModuleKeys = [] }) {
  const pathname = usePathname();
  const router = useRouter();

  const visibleSet = useMemo(() => new Set(visibleModuleKeys), [visibleModuleKeys]);

  const initialKey = extractModuleKey(pathname);
  const initialActive = initialKey && visibleSet.has(initialKey) ? initialKey : null;

  // Keeps a list of module keys whose panels stay mounted (so the user can multitask).
  const [openTabs, setOpenTabs] = useState(() => (initialActive ? [initialActive] : []));

  // The currently active tab key (only one panel is visible at a time).
  const [activeKey, setActiveKey] = useState(() => initialActive);

  useEffect(() => {
    const k = extractModuleKey(pathname);
    if (!k) return;
    if (!visibleSet.has(k)) return;

    setActiveKey(k);
    setOpenTabs((prev) => (prev.includes(k) ? prev : [...prev, k]));
  }, [pathname, visibleSet]);

  if (!activeKey) {
    return <div className="card">No module selected.</div>;
  }

  function activateTab(key) {
    // Activating a tab updates state and keeps the URL in sync for refresh/back navigation.
    setActiveKey(key);
    router.push(`/dashboard/${key}`);
    setOpenTabs((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }

  function closeTab(key, e) {
    if (e) e.stopPropagation();
    // Compute next tabs/active outside of state updater to avoid calling `router.push`
    // during React's state reconciliation.
    const nextTabs = openTabs.filter((t) => t !== key);

    // If the active tab is being closed and there are no tabs left,
    // go back to the dashboard landing (no module selected).
    if (key === activeKey && nextTabs.length === 0) {
      setOpenTabs([]);
      setActiveKey(null);
      router.push(`/dashboard`);
      return;
    }

    let nextActive = activeKey;
    if (key === activeKey) {
      // Keep the remaining tabs, but pick the last one as active.
      nextActive = nextTabs[nextTabs.length - 1];
    }

    setOpenTabs(nextTabs);
    setActiveKey(nextActive);
    if (nextActive && key === activeKey) router.push(`/dashboard/${nextActive}`);
  }

  return (
    <div className="dashboard-tabs">
      <div className="dashboard-tabs-bar" role="tablist" aria-label="Module tabs">
        {openTabs.map((k) => {
          const label = modules[k]?.label || k;
          const icon = modules[k]?.icon || "📄";
          const isActive = k === activeKey;
          return (
            <button
              key={k}
              type="button"
              className={`dashboard-tab ${isActive ? "is-active" : ""}`}
              onClick={() => activateTab(k)}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tab-panel-${k}`}
              title={label}
            >
              <span className="dashboard-tab-icon" aria-hidden>
                {icon}
              </span>
              <span className="dashboard-tab-label">{label}</span>
              <span
                className="dashboard-tab-close"
                onClick={(e) => closeTab(k, e)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") closeTab(k, e);
                }}
                aria-label={`Close ${label} tab`}
                title="Close tab"
              >
                ×
              </span>
            </button>
          );
        })}
      </div>

      <div className="dashboard-tabs-content">
        {openTabs.map((k) => {
          const isActive = k === activeKey;
          return (
            <div
              key={`panel-${k}`}
              id={`tab-panel-${k}`}
              role="tabpanel"
              aria-hidden={!isActive}
              style={{ display: isActive ? "block" : "none" }}
            >
              {k === "user_permissions" ? (
                <UserPermissionsMatrixClient isActive={isActive} />
              ) : (
                <MasterModuleClient moduleKey={k} isActive={isActive} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

