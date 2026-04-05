"use client";

/**
 * Dynamic `/dashboard/:module` route: the dashboard layout renders module UI via `DashboardTabs`,
 * not this page. This file exists so direct navigation to `/dashboard/<key>` still matches a route.
 */
export default function DashboardModulePage() {
  return null;
}
