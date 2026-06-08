"use client";

// Generic/shared file used across modules.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * URL-driven tabs under `/dashboard/:module`: keeps inactive modules mounted (state preserved) while
 * syncing the address bar for refresh and back/forward. Most tabs use `MasterModuleClient`;
 * `user_permissions` uses `UserPermissionsMatrixClient`.
 * At most MAX_OPEN_TABS modules may be open; opening another shows a toast and keeps the current tab.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { modules } from "../config/modules";
import { reports } from "../config/reports";
import MasterModuleClient from "./MasterModuleClient";
import ReportModuleClient from "./ReportModuleClient";
import UserPermissionsMatrixClient from "./UserPermissionsMatrixClient";
import ToastNotice from "./ToastNotice";
import DashboardWidgetLoader from "./dashboards/DashboardWidgetLoader";

const MAX_OPEN_TABS = 5;

function extractModuleKey(pathname) {
  // Expected patterns: /dashboard/<module> or /dashboard/<module>/*
  const parts = String(pathname || "").split("/").filter(Boolean);
  if (parts.length < 2) return null;
  if (parts[0] !== "dashboard") return null;
  return parts[1] || null;
}

/**
 * In-page dashboard tabs: keeps multiple module screens mounted so users can multitask.
 * Also renders landing dashboard widgets (permission-filtered) on `/dashboard`.
 * @param {{ visibleModuleKeys: string[], visibleDashboards?: Array<{ key: string, title: string, description?: string, icon?: string, tone?: string }> }} props
 */
export default function DashboardTabs({ visibleModuleKeys = [], visibleDashboards = [] }) {
  const pathname = usePathname();
  const router = useRouter();

  const visibleSet = useMemo(() => new Set(visibleModuleKeys), [visibleModuleKeys]);

  const initialKey = extractModuleKey(pathname);
  const initialActive = initialKey && visibleSet.has(initialKey) ? initialKey : null;

  // Keeps a list of module keys whose panels stay mounted (so the user can multitask).
  const [openTabs, setOpenTabs] = useState(() => (initialActive ? [initialActive] : []));

  // The currently active tab key (only one panel is visible at a time).
  const [activeKey, setActiveKey] = useState(() => initialActive);

  const activeKeyRef = useRef(activeKey);
  useEffect(() => {
    activeKeyRef.current = activeKey;
  }, [activeKey]);

  const [toast, setToast] = useState(null);
  const [dashboardCache, setDashboardCache] = useState({});

  const landingWidgets = useMemo(
    () => visibleDashboards.filter((d) => d.landingWidget),
    [visibleDashboards]
  );

  const updateDashboardCache = useCallback((key, entry) => {
    setDashboardCache((prev) => ({ ...prev, [key]: entry }));
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const k = extractModuleKey(pathname);
    if (!k) {
      // `/dashboard` landing: show dashboard widgets, no active module panel.
      setActiveKey(null);
      return;
    }
    if (!visibleSet.has(k)) return;

    setOpenTabs((prev) => {
      if (prev.includes(k)) {
        setActiveKey(k);
        return prev;
      }
      if (prev.length >= MAX_OPEN_TABS) {
        // Enforce tab cap: toast and stay on the current module instead of opening a 6th tab.
        setTimeout(() => {
          setToast({
            kind: "error",
            message: `You can open at most ${MAX_OPEN_TABS} modules at once. Close a tab before opening another.`,
          });
          const stay = activeKeyRef.current;
          if (stay) router.replace(`/dashboard/${stay}`);
          else router.replace("/dashboard");
        }, 0);
        return prev;
      }
      setActiveKey(k);
      return [...prev, k];
    });
  }, [pathname, visibleSet, router]);

  if (!activeKey) {
    return (
      <section className="dashboard-landing" aria-label="Dashboards">
        {landingWidgets.length ? (
          <div className="dashboard-widget-grid dashboard-widget-grid--landing">
            {landingWidgets.map((d) => (
              <div key={d.key} id={`dashboard-widget-${d.key}`} className="dashboard-widget-slot">
                <DashboardWidgetLoader
                  dashboardKey={d.key}
                  cache={dashboardCache[d.key] || {}}
                  onCacheUpdate={updateDashboardCache}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="dashboard-landing-empty">
            No dashboard is assigned to your account. Contact administrator to grant dashboard permissions.
          </p>
        )}
      </section>
    );
  }

  function activateTab(key) {
    // Activating a tab updates state and keeps the URL in sync for refresh/back navigation.
    setActiveKey(key);
    router.push(`/dashboard/${key}`);
    setOpenTabs((prev) => (prev.includes(key) ? prev : prev.length < MAX_OPEN_TABS ? [...prev, key] : prev));
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
      <ToastNotice toast={toast} onClose={() => setToast(null)} />
      <div className="dashboard-tabs-bar" role="tablist" aria-label="Module tabs">
        {openTabs.map((k) => {
          const label = modules[k]?.label || reports[k]?.label || k;
          const icon = modules[k]?.icon || reports[k]?.icon || "📄";
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
              ) : reports[k] ? (
                <ReportModuleClient reportKey={k} isActive={isActive} />
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
