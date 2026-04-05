"use client";

/**
 * Time-of-day greeting + display name from DashboardUserProvider (derived from session email on the server layout).
 */
import { useDashboardUser } from "./DashboardUserProvider";

/** Local hour buckets: morning / afternoon / evening / night */
function greetingForHour(date) {
  const h = date.getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  if (h >= 17 && h < 22) return "Good evening";
  return "Good night";
}

/** Greeting in the white top header bar (left), next to theme + profile. */
export default function TopbarGreeting() {
  const { displayName } = useDashboardUser();
  const phrase = greetingForHour(new Date());

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
