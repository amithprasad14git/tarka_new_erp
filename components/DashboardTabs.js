"use client";

// Generic/shared file used across modules.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * URL-driven tabs under `/dashboard/:module`: keeps inactive modules mounted (state preserved) while
 * syncing the address bar for refresh and back/forward. Most tabs use `MasterModuleClient`;
 * `user_permissions` uses `UserPermissionsMatrixClient`.
 * At most MAX_OPEN_TABS modules may be open; opening another shows a toast and keeps the current tab.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { modules } from "../config/modules";
import MasterModuleClient from "./MasterModuleClient";
import UserPermissionsMatrixClient from "./UserPermissionsMatrixClient";
import ToastNotice from "./ToastNotice";

const MAX_OPEN_TABS = 5;

const SAMPLE_DASHBOARD_DATA = {
  cases_overview: {
    kpis: [
      { label: "Total Cases", value: "1,248" },
      { label: "Returned", value: "96" },
      { label: "Final Stage", value: "421" },
      { label: "In Progress", value: "731" }
    ],
    bars: [
      { label: "Closed", value: 34 },
      { label: "Returned", value: 8 },
      { label: "Auctioned", value: 12 },
      { label: "Regularized", value: 19 },
      { label: "Active", value: 27 }
    ],
    rows: [
      { caseNo: "SBI/AL/00021", branch: "Hunsur", status: "Returned", age: "11 days" },
      { caseNo: "CAN/SRF/00104", branch: "Mysore Main", status: "Closed", age: "4 days" },
      { caseNo: "UCO/VL/00009", branch: "Mandya", status: "Auctioned", age: "17 days" }
    ]
  },
  recovery_snapshot: {
    kpis: [
      { label: "Month Recovery", value: "Rs. 18,42,000" },
      { label: "Week Recovery", value: "Rs. 4,38,500" },
      { label: "Avg / Case", value: "Rs. 52,714" },
      { label: "Recovered Cases", value: "349" }
    ],
    bars: [
      { label: "Week 1", value: 22 },
      { label: "Week 2", value: 27 },
      { label: "Week 3", value: 31 },
      { label: "Week 4", value: 20 }
    ],
    rows: [
      { date: "12-04-2026", caseNo: "SBI/CF/00218", amount: "Rs. 1,20,000" },
      { date: "13-04-2026", caseNo: "CAN/AL/00192", amount: "Rs. 80,500" },
      { date: "14-04-2026", caseNo: "UCO/SRF/00055", amount: "Rs. 64,000" }
    ]
  },
  operations_queue: {
    kpis: [
      { label: "Pending Follow-up", value: "84" },
      { label: "Due Today", value: "19" },
      { label: "Overdue", value: "11" },
      { label: "Escalated", value: "6" }
    ],
    bars: [
      { label: "New", value: 26 },
      { label: "Assigned", value: 31 },
      { label: "Blocked", value: 12 },
      { label: "Waiting Docs", value: 18 },
      { label: "Resolved", value: 13 }
    ],
    rows: [
      { queueId: "Q-1008", owner: "Niveditha MN", task: "Visit confirmation", due: "15-04-2026" },
      { queueId: "Q-1011", owner: "Ramesh S", task: "Legal notice update", due: "15-04-2026" },
      { queueId: "Q-1012", owner: "Amith P", task: "Auction document pack", due: "16-04-2026" }
    ]
  }
};

const LANDING_SAMPLE_WIDGETS = {
  unitTargetRecovery: [
    { unit: "Unit 1 - Mysore", caseTarget: 120, recoveryTargetLakh: 95, achievedLakh: 62 },
    { unit: "Unit 2 - Mandya", caseTarget: 90, recoveryTargetLakh: 72, achievedLakh: 54 },
    { unit: "Unit 3 - Hassan", caseTarget: 70, recoveryTargetLakh: 58, achievedLakh: 37 },
    { unit: "Unit 4 - Tumkur", caseTarget: 64, recoveryTargetLakh: 49, achievedLakh: 28 },
    { unit: "Unit 5 - Niveditha", caseTarget: 110, recoveryTargetLakh: 88, achievedLakh: 66 }
  ],
  dayWiseNewCaseInward: [
    { day: "Mon", count: 14 },
    { day: "Tue", count: 18 },
    { day: "Wed", count: 12 },
    { day: "Thu", count: 21 },
    { day: "Fri", count: 17 },
    { day: "Sat", count: 9 },
    { day: "Sun", count: 4 }
  ],
  monthWiseFinalStatusNoReturned: [
    { month: "Jan", closed: 22, settled: 11, regularized: 8, auctioned: 5 },
    { month: "Feb", closed: 19, settled: 9, regularized: 7, auctioned: 4 },
    { month: "Mar", closed: 26, settled: 13, regularized: 10, auctioned: 6 },
    { month: "Apr", closed: 17, settled: 10, regularized: 6, auctioned: 3 },
    { month: "May", closed: 21, settled: 12, regularized: 9, auctioned: 5 },
    { month: "Jun", closed: 16, settled: 8, regularized: 5, auctioned: 2 }
  ]
};

function UnitTargetDonut({ rows }) {
  const totalTarget = rows.reduce((s, r) => s + Number(r.recoveryTargetLakh || 0), 0);
  const totalAchieved = rows.reduce((s, r) => s + Number(r.achievedLakh || 0), 0);
  const pct = totalTarget > 0 ? Math.max(0, Math.min(100, (totalAchieved / totalTarget) * 100)) : 0;
  const r = 48;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <div className="dashboard-donut-wrap">
      <svg width="132" height="132" viewBox="0 0 132 132" className="dashboard-donut">
        <circle cx="66" cy="66" r={r} className="dashboard-donut-track" />
        <circle
          cx="66"
          cy="66"
          r={r}
          className="dashboard-donut-fill"
          strokeDasharray={`${dash} ${c - dash}`}
        />
      </svg>
      <div className="dashboard-donut-center">
        <strong>{pct.toFixed(1)}%</strong>
        <span>achieved</span>
      </div>
      <div className="dashboard-donut-meta">
        <span>Target: {totalTarget} L</span>
        <span>Achieved: {totalAchieved} L</span>
      </div>
    </div>
  );
}

function MonthWiseStackedBars({ rows }) {
  return (
    <div className="dashboard-stack-list">
      {rows.map((r) => {
        const total = r.closed + r.settled + r.regularized + r.auctioned;
        const p1 = total ? (r.closed / total) * 100 : 0;
        const p2 = total ? (r.settled / total) * 100 : 0;
        const p3 = total ? (r.regularized / total) * 100 : 0;
        const p4 = total ? (r.auctioned / total) * 100 : 0;
        return (
          <div key={r.month} className="dashboard-stack-row">
            <span className="dashboard-stack-label">{r.month}</span>
            <div className="dashboard-stack-track">
              <span className="dashboard-stack-seg dashboard-stack-seg--closed" style={{ width: `${p1}%` }} />
              <span className="dashboard-stack-seg dashboard-stack-seg--settled" style={{ width: `${p2}%` }} />
              <span
                className="dashboard-stack-seg dashboard-stack-seg--regularized"
                style={{ width: `${p3}%` }}
              />
              <span className="dashboard-stack-seg dashboard-stack-seg--auctioned" style={{ width: `${p4}%` }} />
            </div>
            <span className="dashboard-stack-value">{total}</span>
          </div>
        );
      })}
      <div className="dashboard-stack-legend">
        <span><i className="dashboard-stack-seg dashboard-stack-seg--closed" />Closed</span>
        <span><i className="dashboard-stack-seg dashboard-stack-seg--settled" />Settled</span>
        <span><i className="dashboard-stack-seg dashboard-stack-seg--regularized" />Regularized</span>
        <span><i className="dashboard-stack-seg dashboard-stack-seg--auctioned" />Auctioned</span>
      </div>
    </div>
  );
}

function extractModuleKey(pathname) {
  // Expected patterns: /dashboard/<module> or /dashboard/<module>/*
  const parts = String(pathname || "").split("/").filter(Boolean);
  if (parts.length < 2) return null;
  if (parts[0] !== "dashboard") return null;
  return parts[1] || null;
}

/**
 * In-page dashboard tabs: keeps multiple module screens mounted so users can multitask.
 * Also renders landing dashboard cards (permission-filtered) on `/dashboard`.
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
  const [selectedDashboardKey, setSelectedDashboardKey] = useState(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const k = extractModuleKey(pathname);
    if (!k) {
      // `/dashboard` landing: show dashboard cards, no active module panel.
      setActiveKey(null);
      // keep selected dashboard panel only on landing URL
      return;
    }
    if (!visibleSet.has(k)) return;
    setSelectedDashboardKey(null);

    setOpenTabs((prev) => {
      if (prev.includes(k)) {
        setActiveKey(k);
        return prev;
      }
      if (prev.length >= MAX_OPEN_TABS) {
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
    const selectedDashboard = visibleDashboards.find((d) => d.key === selectedDashboardKey) || null;
    const sample = selectedDashboard ? SAMPLE_DASHBOARD_DATA[selectedDashboard.key] : null;

    if (selectedDashboard && sample) {
      return (
        <section className="dashboard-landing card" aria-label="Dashboard details">
          <div className="dashboard-widget-header">
            <button
              type="button"
              className="master-btn master-btn-outline"
              onClick={() => setSelectedDashboardKey(null)}
            >
              ← Back
            </button>
            <h2 className="dashboard-landing-title dashboard-widget-title">
              {selectedDashboard.icon || "📊"} {selectedDashboard.title}
            </h2>
          </div>

          <div className="dashboard-kpi-grid">
            {sample.kpis.map((k) => (
              <article key={k.label} className="dashboard-kpi-card">
                <p className="dashboard-kpi-label">{k.label}</p>
                <p className="dashboard-kpi-value">{k.value}</p>
              </article>
            ))}
          </div>

          <div className="dashboard-widget-grid">
            <article className="dashboard-widget-card">
              <h3 className="dashboard-widget-card-title">Trend (Sample)</h3>
              <div className="dashboard-bars">
                {sample.bars.map((b) => (
                  <div key={b.label} className="dashboard-bar-row">
                    <span className="dashboard-bar-label">{b.label}</span>
                    <div className="dashboard-bar-track">
                      <div className="dashboard-bar-fill" style={{ width: `${Math.max(4, b.value)}%` }} />
                    </div>
                    <span className="dashboard-bar-value">{b.value}%</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="dashboard-widget-card">
              <h3 className="dashboard-widget-card-title">Recent Records (Sample)</h3>
              <div className="dashboard-sample-table-wrap">
                <table className="dashboard-sample-table">
                  <thead>
                    <tr>
                      {Object.keys(sample.rows[0] || {}).map((k) => (
                        <th key={k}>{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sample.rows.map((r, idx) => (
                      <tr key={idx}>
                        {Object.entries(r).map(([k, v]) => (
                          <td key={k}>{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </div>
        </section>
      );
    }

    return (
      <section className="dashboard-landing card" aria-label="Dashboards">
        <h2 className="dashboard-landing-title">Dashboards</h2>
        <div className="dashboard-widget-grid dashboard-widget-grid--landing">
          <article className="dashboard-widget-card">
            <h3 className="dashboard-widget-card-title">Unit Wise Case Target / Recovery Target (Sample)</h3>
              <div className="dashboard-unit-split">
                <UnitTargetDonut rows={LANDING_SAMPLE_WIDGETS.unitTargetRecovery} />
                <div className="dashboard-bars">
                  {LANDING_SAMPLE_WIDGETS.unitTargetRecovery.map((r) => {
                    const pct = r.recoveryTargetLakh
                      ? Math.max(0, Math.min(100, (r.achievedLakh / r.recoveryTargetLakh) * 100))
                      : 0;
                    return (
                      <div key={r.unit} className="dashboard-bar-row">
                        <span className="dashboard-bar-label">{r.unit}</span>
                        <div className="dashboard-bar-track">
                          <div className="dashboard-bar-fill" style={{ width: `${Math.max(4, pct)}%` }} />
                        </div>
                        <span className="dashboard-bar-value">{pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
            </div>
          </article>

          <article className="dashboard-widget-card">
            <h3 className="dashboard-widget-card-title">Day Wise New Case Inward Trend (Sample)</h3>
            <div className="dashboard-bars">
              {LANDING_SAMPLE_WIDGETS.dayWiseNewCaseInward.map((d) => (
                <div key={d.day} className="dashboard-bar-row">
                  <span className="dashboard-bar-label">{d.day}</span>
                  <div className="dashboard-bar-track">
                    <div className="dashboard-bar-fill" style={{ width: `${Math.max(6, d.count * 4)}%` }} />
                  </div>
                  <span className="dashboard-bar-value">{d.count}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="dashboard-widget-card">
            <h3 className="dashboard-widget-card-title">Month Wise Final Case Status (Except Returned) (Sample)</h3>
            <MonthWiseStackedBars rows={LANDING_SAMPLE_WIDGETS.monthWiseFinalStatusNoReturned} />
          </article>
        </div>

        {visibleDashboards.length ? (
          <div className="dashboard-landing-grid">
            {visibleDashboards.map((d) => (
              <button
                key={d.key}
                type="button"
                className={`dashboard-card dashboard-card--${d.tone || "brand"}`}
                onClick={() => setSelectedDashboardKey(d.key)}
              >
                <div className="dashboard-card-icon" aria-hidden="true">
                  {d.icon || "📊"}
                </div>
                <h3 className="dashboard-card-title">{d.title || d.key}</h3>
                <p className="dashboard-card-desc">{d.description || "Dashboard view."}</p>
              </button>
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

