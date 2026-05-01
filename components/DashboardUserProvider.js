"use client";

// Generic/shared file used across modules.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * React context for the logged-in user’s identity used by greeting and profile UI.
 */
import { createContext, useContext, useMemo } from "react";

const DashboardUserContext = createContext({
  fullName: "",
  email: "",
  displayName: "",
  unitId: null
});

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
 * @param {{ children: import("react").ReactNode, fullName?: string, email: string, unitId?: number }} props
 */
export function DashboardUserProvider({ children, fullName = "", email, unitId = null }) {
  const normalizedFullName = String(fullName || "").trim();
  const value = useMemo(
    () => ({
      fullName: normalizedFullName,
      email: email || "",
      displayName: normalizedFullName || displayNameFromEmail(email || ""),
      unitId: unitId != null && Number.isFinite(Number(unitId)) ? Number(unitId) : null
    }),
    [normalizedFullName, email, unitId]
  );

  return (
    <DashboardUserContext.Provider value={value}>{children}</DashboardUserContext.Provider>
  );
}

export function useDashboardUser() {
  return useContext(DashboardUserContext);
}
