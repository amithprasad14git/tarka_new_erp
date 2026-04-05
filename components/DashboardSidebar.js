"use client";

/**
 * Dashboard sidebar: module links grouped by `config.group`, with collapsible sections when expanded.
 * Narrow (collapsed) mode shows a flat icon rail + centered expand control — no stray letters.
 * Persisted width via `localStorage` + `data-sidebar` on `<html>`.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const groupIcons = {
  Administration: "🛡️",
  HR: "👥",
  Accounts: "💵",
  Banks: "🏛️",
  Other: "📁"
};

/**
 * @param {{ groups: Record<string, Array<{ key: string, label: string, icon?: string }>> }} props
 */
export default function DashboardSidebar({ groups }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  /** When true, group shows its module links; false = section folded (expanded sidebar only). */
  const groupEntries = useMemo(() => Object.entries(groups), [groups]);

  const [openGroups, setOpenGroups] = useState(() => {
    const o = {};
    for (const [name, items] of Object.entries(groups)) {
      o[name] = items.some((item) => pathname === `/dashboard/${item.key}`);
    }
    return o;
  });

  useEffect(() => {
    const saved = localStorage.getItem("erp-sidebar") || "expanded";
    const isCollapsed = saved === "collapsed";
    setCollapsed(isCollapsed);
    document.documentElement.setAttribute("data-sidebar", saved);
  }, []);

  // New module groups start closed unless they contain the active screen; navigating always opens that group.
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      for (const [name, items] of groupEntries) {
        if (!(name in next)) {
          next[name] = items.some((item) => pathname === `/dashboard/${item.key}`);
        }
        if (items.some((item) => pathname === `/dashboard/${item.key}`)) {
          next[name] = true;
        }
      }
      return next;
    });
  }, [pathname, groupEntries]);

  function toggleSidebar() {
    const next = !collapsed;
    setCollapsed(next);
    const mode = next ? "collapsed" : "expanded";
    localStorage.setItem("erp-sidebar", mode);
    document.documentElement.setAttribute("data-sidebar", mode);
  }

  const toggleGroup = useCallback((name) => {
    setOpenGroups((p) => ({ ...p, [name]: !p[name] }));
  }, []);

  const isGroupOpen = useCallback((name) => openGroups[name] === true, [openGroups]);

  /** Collapsed rail: one row per module, in group order, for touch-friendly targets. */
  const flatItems = useMemo(() => {
    const out = [];
    for (const [, items] of groupEntries) {
      for (const item of items) out.push(item);
    }
    return out;
  }, [groupEntries]);

  return (
    <aside className="flux-sidebar" aria-label="Main navigation">
      <div className={`flux-sidebar-header${collapsed ? " flux-sidebar-header--collapsed" : ""}`}>
        {!collapsed ? (
          <h2 className="flux-brand">Tarka 2.0</h2>
        ) : (
          <span className="sr-only">Tarka 2.0</span>
        )}
        <button
          type="button"
          className="flux-sidebar-toggle"
          onClick={toggleSidebar}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          <span aria-hidden="true">{collapsed ? "»" : "«"}</span>
        </button>
      </div>

      {groupEntries.length === 0 ? (
        <p className="muted">No modules available for your role.</p>
      ) : collapsed ? (
        <nav className="flux-sidebar-nav-collapsed" aria-label="Modules">
          {flatItems.map((item) => {
            const href = `/dashboard/${item.key}`;
            const active = pathname === href;
            return (
              <Link
                key={item.key}
                href={href}
                title={item.label}
                className={`flux-link flux-link-icon-only ${active ? "active" : ""}`}
              >
                <span className="flux-link-icon" aria-hidden="true">
                  {item.icon || "📄"}
                </span>
                <span className="sr-only">{item.label}</span>
              </Link>
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
                      <Link
                        key={item.key}
                        href={href}
                        className={`flux-link ${active ? "active" : ""}`}
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
      )}
    </aside>
  );
}
