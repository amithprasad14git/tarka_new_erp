"use client";

// Generic/shared file used across modules.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Time-of-day greeting + display name from DashboardUserProvider (derived from session email on the server layout).
 */
import { useDashboardUser } from "./DashboardUserProvider";

/** Current hour 0–23 in IST (for greeting buckets only). */
function clockHourIST() {
  const raw = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    hour12: false
  })
    .formatToParts(new Date())
    .find((p) => p.type === "hour")?.value;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** IST hour buckets: morning / afternoon / evening / night */
function greetingForHour(hour) {
  const h = hour;
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  if (h >= 17 && h < 22) return "Good evening";
  return "Good night";
}

/** Greeting in the white top header bar (left), next to theme + profile. */
export default function TopbarGreeting() {
  const { displayName } = useDashboardUser();
  const phrase = greetingForHour(clockHourIST());

  // Hide the greeting if we cannot derive a display name.
  if (!displayName) return <div className="topbar-greeting-slot" aria-hidden />;

  return (
    <div className="topbar-greeting-slot">
      <p className="topbar-greeting" role="status">
        {phrase}, <span className="topbar-greeting-name">{displayName}</span>
      </p>
    </div>
  );
}
