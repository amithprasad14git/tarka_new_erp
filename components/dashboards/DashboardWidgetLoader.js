"use client";

// Generic dashboard fetch + client-side cache wrapper for landing widgets.

import { useCallback, useEffect, useRef } from "react";
import { readApiErrorMessage, readJsonResponse } from "../../lib/fetchClientError";
import UnitWiseRecoveryTargetWidget from "./unit_wise_recovery_target/UnitWiseRecoveryTargetWidget";

/**
 * @typedef {{ data?: object | null, lastFetchedAt?: number | null, loading?: boolean, error?: string | null }} DashboardCacheEntry
 */

/**
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
      const current = cacheRef.current;
      if (current.loading) return;
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
          const msg = readApiErrorMessage(body) || "Failed to load dashboard";
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

  return null;
}
