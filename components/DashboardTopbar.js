"use client";

// Generic/shared file used across modules.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Header strip: ambient micro-icon lane (React-timed bursts), IST clock, theme, user menu.
 *
 * Sparkle timing (burst length, idle gap, drift speed) lives in `TopbarMicroFloatLane.js`
 * at the top as `BURST_DURATION_MS`, `IDLE_GAP_MS`, and `ICON_DRIFT_SECONDS`.
 */
import ThemeToggle from "./ThemeToggle";
import TopbarIstClock from "./TopbarIstClock";
import TopbarMicroFloatLane from "./TopbarMicroFloatLane";
import UserMenu from "./UserMenu";

/**
 * Expands in the topbar; micro lane fills remaining width (flex: 1).
 * @param {{ userUsername: string, userFullName?: string }} props
 */
export default function DashboardTopbar({ userUsername, userFullName = "" }) {
  return (
    // Right-side cluster: sparkle lane, clock, theme, account menu.
    <div className="dashboard-topbar-actions">
      <TopbarMicroFloatLane />
      <TopbarIstClock />
      <ThemeToggle />
      <UserMenu username={userUsername} fullName={userFullName} />
    </div>
  );
}
