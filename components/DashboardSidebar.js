"use client";

// Generic/shared file used across modules.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Dashboard sidebar: module links grouped by `config.group`, with collapsible sections when expanded.
 * Desktop: expanded = grouped lists; collapsed = one icon per **group** (main menu), submenus in a flyout.
 * Mobile (≤900px): logo + hamburger only; full navigation opens in a fixed overlay drawer.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MOBILE_MQ = "(max-width: 900px)";
const LOGO_SRC = "/images/NPA_04_bg_removed.png";

// Icons for sidebar section headers — keys must match `group` in config/modules.js and config/reports.js exactly.
// Keys with spaces must be quoted, e.g. "Case Related Reports": "📊"
const groupIcons = {
  Administration: "🛡️",
  HR: "👥",
  Accounts: "💵",
  Lookups: "🛠️",
  Banks: "🏛️",
  Cases: "📚",
  "Tasks & Reminders": "✅",
  "Case Related Reports": "📊",
  "General Reports": "🗂️",
  "Accounts Reports": "📑",
};

/**
 * @param {{ groups: Record<string, Array<{ key: string, label: string, icon?: string }>> }} props
 */
export default function DashboardSidebar({ groups }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  /** Desktop collapsed rail: which group's flyout submenu is open (main menus only in the rail). */
  const [collapsedFlyout, setCollapsedFlyout] = useState(null);
  const sidebarRef = useRef(null);

  const groupEntries = useMemo(() => Object.entries(groups), [groups]);

  const [openGroups, setOpenGroups] = useState(() => {
    const o = {};
    for (const [name, items] of Object.entries(groups)) {
      o[name] = items.some((item) => pathname === `/dashboard/${item.key}`);
    }
    return o;
  });

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia(MOBILE_MQ);
    const applyLayout = () => {
      const isMobile = mq.matches;
      setMobile(isMobile);
      // Mobile uses overlay drawer; desktop restores saved collapsed/expanded preference.
      if (isMobile) {
        setDrawerOpen(false);
        setCollapsed(true);
        document.documentElement.setAttribute("data-sidebar", "collapsed");
      } else {
        const saved = localStorage.getItem("erp-sidebar") || "expanded";
        const isCollapsed = saved === "collapsed";
        setCollapsed(isCollapsed);
        document.documentElement.setAttribute("data-sidebar", isCollapsed ? "collapsed" : "expanded");
      }
    };
    applyLayout();
    mq.addEventListener("change", applyLayout);
    return () => mq.removeEventListener("change", applyLayout);
  }, []);

  useEffect(() => {
    // Keep only the active module's parent group expanded on route change.
    setOpenGroups((prev) => {
      const activeGroup = groupEntries.find(([, items]) =>
        items.some((item) => pathname === `/dashboard/${item.key}`)
      )?.[0];
      const next = {};
      for (const [name] of groupEntries) {
        next[name] = activeGroup ? name === activeGroup : Boolean(prev[name]);
      }
      return next;
    });
  }, [pathname, groupEntries]);

  useEffect(() => {
    if (!drawerOpen || !mobile) return;
    const onKey = (e) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      if (document.body) document.body.style.overflow = prevOverflow;
    };
  }, [drawerOpen, mobile]);

  useEffect(() => {
    if (!collapsedFlyout) return;
    const onDoc = (e) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        setCollapsedFlyout(null);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [collapsedFlyout]);

  useEffect(() => {
    if (!collapsedFlyout) return;
    const onEsc = (e) => {
      if (e.key === "Escape") setCollapsedFlyout(null);
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [collapsedFlyout]);

  useEffect(() => {
    setCollapsedFlyout(null);
  }, [pathname]);

  useEffect(() => {
    if (!collapsed) setCollapsedFlyout(null);
  }, [collapsed]);

  function toggleSidebar() {
    if (mobile) {
      setDrawerOpen((o) => !o);
      return;
    }
    const next = !collapsed;
    setCollapsed(next);
    const mode = next ? "collapsed" : "expanded";
    localStorage.setItem("erp-sidebar", mode);
    document.documentElement.setAttribute("data-sidebar", mode);
  }

  const toggleGroup = useCallback(
    (name) => {
      setOpenGroups((prev) => {
        // Single-expand behavior:
        // - click open group -> close all
        // - click closed group -> open only that one
        const closingCurrent = Boolean(prev[name]);
        const next = {};
        for (const [groupName] of groupEntries) {
          next[groupName] = closingCurrent ? false : groupName === name;
        }
        return next;
      });
    },
    [groupEntries]
  );

  const isGroupOpen = useCallback((name) => openGroups[name] === true, [openGroups]);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const expandedNav = (
    <nav className="flux-sidebar-nav-expanded flux-sidebar-drawer-nav" aria-label="Modules by group">
      {groupEntries.map(([groupName, items]) => {
        const open = isGroupOpen(groupName);
        const groupIcon = groupIcons[groupName] || "📂";
        const panelId = `drawer-group-${groupName.replace(/\s+/g, "-").toLowerCase()}`;
        return (
          <div key={groupName} className="flux-group">
            <button
              type="button"
              className="flux-group-toggle"
              onClick={() => toggleGroup(groupName)}
              aria-expanded={open}
              aria-controls={panelId}
              id={`${panelId}-btn`}
            >
              <span className="flux-group-toggle-icon" aria-hidden="true">
                {groupIcon}
              </span>
              <span className="flux-group-toggle-label">{groupName}</span>
              <span className="flux-group-toggle-chevron" aria-hidden="true">
                {open ? "▾" : "▸"}
              </span>
            </button>
            <div
              id={panelId}
              role="region"
              aria-labelledby={`${panelId}-btn`}
              className={`flux-group-panel${open ? "" : " flux-group-panel--closed"}`}
            >
              {items.map((item) => {
                const href = `/dashboard/${item.key}`;
                const active = pathname === href;
                return (
                  <Link
                    key={item.key}
                    href={href}
                    className={`flux-link ${active ? "active" : ""}`}
                    onClick={closeDrawer}
                  >
                    <span className="flux-link-emoji" aria-hidden="true">
                      {item.icon || "📄"}
                    </span>
                    <span className="flux-link-text">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );

  const headerCollapsedClass = collapsed && !mobile ? " flux-sidebar-header--collapsed" : "";
  const mobileClass = mobile ? " flux-sidebar--mobile" : "";

  const brandLogo = mobile ? (
    <Link href="/dashboard" className="flux-brand-link">
      <img
        src={LOGO_SRC}
        alt="Tarka — Solutions that work"
        className="flux-brand-logo flux-brand-logo--mobile"
        width={160}
        height={36}
      />
    </Link>
  ) : collapsed ? (
    <Link href="/dashboard" className="flux-brand-link flux-brand-link--collapsed" title="Tarka — Home">
      <img src={LOGO_SRC} alt="" className="flux-brand-logo flux-brand-logo--collapsed" width={40} height={40} />
      <span className="sr-only">Tarka — Home</span>
    </Link>
  ) : (
    <Link href="/dashboard" className="flux-brand-link">
      <img
        src={LOGO_SRC}
        alt="Tarka — Solutions that Work"
        className="flux-brand-logo"
        width={200}
        height={44}
      />
    </Link>
  );

  return (
    <aside ref={sidebarRef} className={`flux-sidebar${mobileClass}`} aria-label="Main navigation">
      <div className={`flux-sidebar-header${headerCollapsedClass}${mobile ? " flux-sidebar-header--mobile" : ""}`}>
        {brandLogo}
        <button
          type="button"
          className="flux-sidebar-toggle"
          onClick={toggleSidebar}
          title={mobile ? (drawerOpen ? "Close menu" : "Open menu") : collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={mobile ? drawerOpen : !collapsed}
        >
          <span aria-hidden="true">{mobile ? (drawerOpen ? "✕" : "☰") : "☰"}</span>
        </button>
      </div>

      {groupEntries.length === 0 ? (
        <p className="muted">No modules available for your role.</p>
      ) : mobile ? null : collapsed ? (
        <nav className="flux-sidebar-nav-collapsed flux-sidebar-nav-groups-rail" aria-label="Module groups">
          {groupEntries.map(([groupName, items]) => {
            const groupIcon = groupIcons[groupName] || "📂";
            const groupActive = items.some((item) => pathname === `/dashboard/${item.key}`);
            const flyoutOpen = collapsedFlyout === groupName;
            return (
              <div key={groupName} className="flux-sidebar-group-slot">
                <button
                  type="button"
                  title={groupName}
                  aria-expanded={flyoutOpen}
                  aria-haspopup="true"
                  className={`flux-link flux-link-icon-only flux-group-rail-btn ${groupActive ? "active" : ""}`}
                  onClick={() => setCollapsedFlyout((g) => (g === groupName ? null : groupName))}
                >
                  <span className="flux-link-icon" aria-hidden="true">
                    {groupIcon}
                  </span>
                  <span className="sr-only">{groupName}</span>
                </button>
                {flyoutOpen ? (
                  <div className="flux-group-flyout" role="menu" aria-label={groupName}>
                    {items.map((item) => {
                      const href = `/dashboard/${item.key}`;
                      const active = pathname === href;
                      return (
                        <Link
                          key={item.key}
                          href={href}
                          role="menuitem"
                          className={`flux-group-flyout-link ${active ? "active" : ""}`}
                          onClick={() => setCollapsedFlyout(null)}
                        >
                          <span className="flux-link-emoji" aria-hidden="true">
                            {item.icon || "📄"}
                          </span>
                          <span className="flux-group-flyout-label">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      ) : (
        <nav className="flux-sidebar-nav-expanded" aria-label="Modules by group">
          {groupEntries.map(([groupName, items]) => {
            const open = isGroupOpen(groupName);
            const groupIcon = groupIcons[groupName] || "📂";
            const panelId = `sidebar-group-${groupName.replace(/\s+/g, "-").toLowerCase()}`;
            return (
              <div key={groupName} className="flux-group">
                <button
                  type="button"
                  className="flux-group-toggle"
                  onClick={() => toggleGroup(groupName)}
                  aria-expanded={open}
                  aria-controls={panelId}
                  id={`${panelId}-btn`}
                >
                  <span className="flux-group-toggle-icon" aria-hidden="true">
                    {groupIcon}
                  </span>
                  <span className="flux-group-toggle-label">{groupName}</span>
                  <span className="flux-group-toggle-chevron" aria-hidden="true">
                    {open ? "▾" : "▸"}
                  </span>
                </button>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={`${panelId}-btn`}
                  className={`flux-group-panel${open ? "" : " flux-group-panel--closed"}`}
                >
                  {items.map((item) => {
                    const href = `/dashboard/${item.key}`;
                    const active = pathname === href;
                    return (
                      <Link key={item.key} href={href} className={`flux-link ${active ? "active" : ""}`}>
                        <span className="flux-link-emoji" aria-hidden="true">
                          {item.icon || "📄"}
                        </span>
                        <span className="flux-link-text">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      )}

      {mounted && mobile && drawerOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="flux-sidebar-drawer-root" role="presentation">
              <div className="flux-sidebar-drawer-backdrop" aria-hidden onClick={closeDrawer} />
              <div
                className="flux-sidebar-drawer-panel"
                role="dialog"
                aria-modal="true"
                aria-label="Navigation menu"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flux-sidebar-drawer-head">
                  <span className="flux-sidebar-drawer-title">Menu</span>
                  <button type="button" className="flux-sidebar-toggle" onClick={closeDrawer} aria-label="Close menu">
                    <span aria-hidden="true">✕</span>
                  </button>
                </div>
                {expandedNav}
              </div>
            </div>,
            document.body
          )
        : null}
    </aside>
  );
}

