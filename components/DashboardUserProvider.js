"use client";

/**
 * React context for the logged-in user’s email and a human-readable display name (used by greeting and future UI).
 */
import { createContext, useContext, useMemo } from "react";

const DashboardUserContext = createContext({ email: "", displayName: "", unitId: null });

/**
 * Derives a friendly name from email local-part (e.g. john.doe → John Doe).
 * @param {string} email
 */
export function displayNameFromEmail(email) {
  if (!email || typeof email !== "string") return "";
  const local = email.split("@")[0]?.trim() || "";
  if (!local) return email;
  return local
    .replace(/[._-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Supplies logged-in user to dashboard client pages (greeting, etc.).
 * @param {{ children: import("react").ReactNode, email: string, unitId?: number }} props
 */
export function DashboardUserProvider({ children, email, unitId = null }) {
  const value = useMemo(
    () => ({
      email: email || "",
      displayName: displayNameFromEmail(email || ""),
      unitId: unitId != null && Number.isFinite(Number(unitId)) ? Number(unitId) : null
    }),
    [email, unitId]
  );

  return (
    <DashboardUserContext.Provider value={value}>{children}</DashboardUserContext.Provider>
  );
}

export function useDashboardUser() {
  return useContext(DashboardUserContext);
}
