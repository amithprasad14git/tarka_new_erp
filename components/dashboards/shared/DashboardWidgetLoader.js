"use client";

// Dashboard widget loader — fetches /api/dashboard/<key> and renders the matching widget.

/**
 * Shared fetch + cache wrapper for all landing dashboard widgets on /dashboard.
 * - Loads data once per session tab; Refresh bypasses cache.
 * - Shows skeleton while loading, retry button on hard failure.
 * - Dispatches to the correct widget component by dashboardKey.
 * Guide: README.md#5a-landing-dashboards
 */

import { useCallback, useEffect, useRef } from "react";
import { formatApiErrorPayload, readJsonResponse } from "../../../lib/fetchClientError";
import MyTasksWidget from "../../task/MyTasksWidget";
import MyRemindersWidget from "../../reminder/MyRemindersWidget";
import UnitWiseRecoveryTargetWidget from "../unit_wise_recovery_target/UnitWiseRecoveryTargetWidget";
import SearchBankBranchWidget from "../search_bank_branch/SearchBankBranchWidget";
import InvoiceCollectionsWidget from "../invoice_collections/InvoiceCollectionsWidget";
import RegionalPerformanceWidget from "../regional_performance/RegionalPerformanceWidget";
import "../../task/task.css";
import "../../reminder/reminder.css";

/**
 * @typedef {{ data?: object | null, lastFetchedAt?: number | null, loading?: boolean, error?: string | null }} DashboardCacheEntry
 */

/**
 * Fetches widget JSON from API; caches until Refresh. Maps dashboardKey → React widget.
 * @param {{
 *   dashboardKey: string,
 *   title?: string,
 *   cache?: DashboardCacheEntry,
 *   onCacheUpdate: (key: string, entry: DashboardCacheEntry) => void
 * }} props
 */
export default function DashboardWidgetLoader({
  dashboardKey,
  cache = {},
  onCacheUpdate
}) {
  const cacheRef = useRef(cache);
  cacheRef.current = cache;

  const fetchDashboard = useCallback(
    async (force = false) => {
      // --- Fetch /api/dashboard/<key> and update parent cache ---
      const current = cacheRef.current;
      if (current.loading) return;
      // Skip refetch unless user clicked Refresh (force=true).
      if (!force && current.data) return;

      onCacheUpdate(dashboardKey, {
        ...current,
        loading: true,
        error: null
      });

      try {
        const res = await fetch(`/api/dashboard/${encodeURIComponent(dashboardKey)}`, {
          cache: "no-store"
        });
        const body = await readJsonResponse(res);
        if (!res.ok) {
          const msg = formatApiErrorPayload(body, "Failed to load dashboard");
          onCacheUpdate(dashboardKey, {
            data: current.data ?? null,
            lastFetchedAt: current.lastFetchedAt ?? null,
            loading: false,
            error: msg
          });
          return;
        }

        onCacheUpdate(dashboardKey, {
          data: body,
          lastFetchedAt: Date.now(),
          loading: false,
          error: null
        });
      } catch {
        onCacheUpdate(dashboardKey, {
          data: current.data ?? null,
          lastFetchedAt: current.lastFetchedAt ?? null,
          loading: false,
          error: "Failed to load dashboard"
        });
      }
    },
    [dashboardKey, onCacheUpdate]
  );

  useEffect(() => {
    fetchDashboard(false);
  }, [fetchDashboard]);

  const { data = null, lastFetchedAt = null, loading = false, error = null } = cache;
  const showSkeleton = loading && !data;

  if (showSkeleton) {
    return (
      <article className="dashboard-widget-card dashboard-widget-card--loading" aria-busy="true">
        <div className="dashboard-widget-skeleton dashboard-widget-skeleton--title" />
        <div className="dashboard-widget-skeleton dashboard-widget-skeleton--chart" />
      </article>
    );
  }

  if (error && !data) {
    return (
      <article className="dashboard-widget-card dashboard-widget-card--error">
        <p className="dashboard-widget-error">{error}</p>
        <button type="button" className="master-btn master-btn-outline" onClick={() => fetchDashboard(true)}>
          Retry
        </button>
      </article>
    );
  }

  // Route each config key to its widget UI (add new dashboards here + registry).
  if (dashboardKey === "unit_wise_recovery_target") {
    return (
      <UnitWiseRecoveryTargetWidget
        data={data}
        loading={loading}
        lastFetchedAt={lastFetchedAt}
        onRefresh={() => fetchDashboard(true)}
      />
    );
  }

  if (dashboardKey === "search_bank_branch") {
    return (
      <SearchBankBranchWidget
        data={data}
        loading={loading}
        lastFetchedAt={lastFetchedAt}
        onRefresh={() => fetchDashboard(true)}
      />
    );
  }

  if (dashboardKey === "invoice_collections") {
    return (
      <InvoiceCollectionsWidget
        data={data}
        loading={loading}
        lastFetchedAt={lastFetchedAt}
        onRefresh={() => fetchDashboard(true)}
      />
    );
  }

  if (dashboardKey === "regional_performance") {
    return (
      <RegionalPerformanceWidget
        data={data}
        loading={loading}
        lastFetchedAt={lastFetchedAt}
        onRefresh={() => fetchDashboard(true)}
      />
    );
  }

  if (dashboardKey === "my_tasks") {
    return (
      <MyTasksWidget
        data={data}
        loading={loading}
        lastFetchedAt={lastFetchedAt}
        onRefresh={() => fetchDashboard(true)}
      />
    );
  }

  if (dashboardKey === "my_reminders") {
    return (
      <MyRemindersWidget
        data={data}
        loading={loading}
        lastFetchedAt={lastFetchedAt}
        onRefresh={() => fetchDashboard(true)}
      />
    );
  }

  return null;
}

